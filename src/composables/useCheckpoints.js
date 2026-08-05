// src/composables/useCheckpoints.js
// Business-Logik-Schicht (Ticket 133) - dieselben Namen/Formen wie
// useCheckpointsMock.js (tickets/133/133.txt, Ziel 1), aus echten
// scans/scan_packets/checkpoints berechnet statt aus dem synthetischen
// Mock-Roster. Uebersetzt die rohen Postgres-Fehler der RPC-Wrapper
// (useSupabaseCheckpoints.js) in dieselbe Fehlerform wie der Mock
// ({error:'ALREADY_OPEN', existingId} usw. - siehe doc/db/checkpoints.sql,
// Kopfkommentar "Error contract").
//
// Abweichung von der Mock-Signatur (dokumentiert, nicht vermeidbar): im Mock
// waren getBusChildrenBreakdown/getGroupChildrenBreakdown/getBusDelta/
// getGroupDelta/getCheckpointBetreuerList synchron, weil buses/groups schon
// im reactive-Objekt eingebettet waren. Hier sind sie zwar weiterhin
// synchron (sie lesen nur cp.buses/cp.groups, die von
// fetchCheckpointsForDay()/fetchCheckpointDetail() bereits eingebettet
// wurden), aber getBusChildrenBreakdown/getGroupChildrenBreakdown und
// getBusDelta/getGroupDelta sind async geworden, weil sie zusaetzlich den
// vollen Kinder-Roster bzw. die Tagesbasis-Checkpoint nachladen muessen.
// Aufrufer (Ticket 134/135) muessen das mit await beruecksichtigen.
import { useConfigStore } from '@/stores/config'
import { useSupabaseCheckpoints } from './useSupabaseCheckpoints'
import { useChildren } from './useChildren'
import { fetchLazyCheckpointProgress } from './useLazyCheckpointProgress'

const {
    fetchCheckpointRowsForDay,
    fetchCheckpointRowById,
    fetchUsersByIds,
    fetchScanPacketsForCheckpoint,
    fetchScansForPacketIds,
    fetchUserGroupDayAssignment,
    rpcCreateCheckpoint,
    rpcFinishCheckpoint,
    rpcSetCheckpointBaseline,
    rpcReopenCheckpoint,
    rpcRemoveCheckpoint
} = useSupabaseCheckpoints()

const { fetchAllChildren, getChildrenByGroup } = useChildren()

export const CHECKPOINT_TYPE = { BUS: 1, GROUP: 2, LAZY: 3 }
export const CHECKPOINT_STATUS = { OPEN: 1, FINISHED: 2 }

export function todayString() {
    return new Date().toISOString().split('T')[0]
}

function getTotals() {
    const configStore = useConfigStore()
    return {
        totalBuses: configStore.totalBuses || 0,
        totalGroups: configStore.totalGroups || 0
    }
}

function mapUserRef(row) {
    if (!row) return null
    return { id: row.id, name: row.display_name, isAdmin: row.role === 'admin' }
}

function mapCheckpointRow(row, usersMap) {
    return {
        id: row.id,
        type: row.type,
        day: row.day,
        status: row.status,
        created_by: usersMap.get(row.created_by) || null,
        created_at: row.created_at,
        finished_at: row.finished_at,
        finished_by: row.finished_by != null ? (usersMap.get(row.finished_by) || null) : null,
        baseline_children_count: row.baseline_children_count
    }
}

function groupBy(list, key) {
    const map = new Map()
    for (const item of list) {
        const k = item[key]
        if (!map.has(k)) map.set(k, [])
        map.get(k).push(item)
    }
    return map
}

/**
 * Bus-Aufschluesselung einer BUS-Checkpoint fuer 1..totalBuses - Union aller
 * Pakete je Bus (decision.md §5, BUS akkumuliert). Ersetzt das statische
 * cp.buses aus dem Mock.
 *
 * @param {number} checkpointId
 * @param {number} totalBuses
 */
async function buildBusesForCheckpoint(checkpointId, totalBuses) {
    const [packets, roster] = await Promise.all([
        fetchScanPacketsForCheckpoint(checkpointId),
        fetchAllChildren()
    ])
    const childrenMap = new Map(roster.map(c => [c.id, c]))
    const scans = await fetchScansForPacketIds(packets.map(p => p.id))
    const authorIds = [...new Set(packets.map(p => p.author_id))]
    const usersRows = await fetchUsersByIds(authorIds)
    const usersMap = new Map(usersRows.map(u => [u.id, mapUserRef(u)]))

    const scansByPacket = groupBy(scans, 'packet_id')
    const packetsByBus = groupBy(packets, 'bus_id')

    const buses = []
    for (let busNumber = 1; busNumber <= totalBuses; busNumber++) {
        const busPackets = packetsByBus.get(busNumber) || []
        const hasData = busPackets.length > 0

        const childIdSet = new Set()
        for (const p of busPackets) {
            for (const s of (scansByPacket.get(p.id) || [])) childIdSet.add(s.child_id)
        }
        const children = [...childIdSet].map(id => {
            const c = childrenMap.get(id)
            return { id, name: c?.name ?? 'Unbekannt', groupId: c?.group_id ?? null }
        })

        const betreuerIds = [...new Set(busPackets.map(p => p.author_id))]
        const betreuer = betreuerIds.map(id => usersMap.get(id)).filter(Boolean)

        buses.push({
            busNumber,
            hasData,
            kinderCount: children.length,
            betreuerCount: betreuer.length,
            betreuer,
            children,
            packets: busPackets.map(p => ({
                id: p.id,
                authorId: p.author_id,
                authorName: usersMap.get(p.author_id)?.name ?? 'Unbekannt',
                receivedAt: p.received_at,
                childrenCount: p.children_count
            }))
        })
    }
    return buses
}

/**
 * Gruppen-Aufschluesselung einer GROUP-Checkpoint fuer 1..totalGroups -
 * "Last Packet Wins" je Gruppe (decision.md §5, GROUP ist ein Snapshot, kein
 * Akkumulator) - anders als buildBusesForCheckpoint().
 *
 * `morning`/missingChildren beziehen sich auf das presentRoster des Tages
 * (tickets/147/147.txt), sofern der Tag bereits eine Tagesbasis hat -
 * ansonsten (noch keine Baseline) auf den vollen Gruppenbestand als
 * einzigen verfuegbaren Anhaltspunkt. presentChildIds (die tatsaechlich
 * gescannten Kind-Ids des letzten Pakets) wird zusaetzlich mitgegeben, damit
 * getGroupChildrenBreakdown() das echte Anwesend/Fehlend nicht ueber den
 * (jetzt presentRoster-eingeschraenkten) missingChildren-Komplement
 * rekonstruieren muss.
 *
 * @param {number} checkpointId
 * @param {number} totalGroups
 * @param {string} day
 */
async function buildGroupsForCheckpoint(checkpointId, totalGroups, day) {
    const [packets, roster, presentRosterIds] = await Promise.all([
        fetchScanPacketsForCheckpoint(checkpointId),
        fetchAllChildren(),
        getDayPresentRosterIds(day)
    ])
    const scans = await fetchScansForPacketIds(packets.map(p => p.id))
    const authorIds = [...new Set(packets.map(p => p.author_id))]
    const usersRows = await fetchUsersByIds(authorIds)
    const usersMap = new Map(usersRows.map(u => [u.id, mapUserRef(u)]))

    const scansByPacket = groupBy(scans, 'packet_id')
    const packetsByGroup = groupBy(packets, 'group_id')

    const groups = []
    for (let groupId = 1; groupId <= totalGroups; groupId++) {
        const groupPackets = packetsByGroup.get(groupId) || []
        const hasData = groupPackets.length > 0
        const groupRoster = roster.filter(c => c.group_id === groupId)
        const referenceRoster = presentRosterIds
            ? groupRoster.filter(c => presentRosterIds.has(c.id))
            : groupRoster
        const morning = referenceRoster.length

        let current = 0
        let missingChildren = []
        let betreuer = []
        let presentChildIds = []

        if (hasData) {
            const latestPacket = groupPackets.reduce((latest, p) =>
                (!latest || new Date(p.received_at) > new Date(latest.received_at)) ? p : latest, null)
            const presentIds = new Set((scansByPacket.get(latestPacket.id) || []).map(s => s.child_id))
            current = presentIds.size
            presentChildIds = [...presentIds]
            missingChildren = referenceRoster
                .filter(c => !presentIds.has(c.id))
                .map(c => ({ id: c.id, name: c.name }))

            const betreuerIds = [...new Set(groupPackets.map(p => p.author_id))]
            betreuer = betreuerIds.map(id => usersMap.get(id)).filter(Boolean)
        }

        groups.push({ groupId, hasData, morning, current, betreuer, missingChildren, presentChildIds })
    }
    return groups
}

async function attachTypeData(cp) {
    const { totalBuses, totalGroups } = getTotals()
    if (cp.type === CHECKPOINT_TYPE.BUS) {
        cp.buses = await buildBusesForCheckpoint(cp.id, totalBuses)
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        cp.groups = await buildGroupsForCheckpoint(cp.id, totalGroups, cp.day)
    }
    return cp
}

/**
 * Liste/Historie der Checkpoints eines Tages inkl. fortlaufender Nummer
 * (seq) und eingebetteter buses/groups (fuer summarizeCheckpoint() etc.).
 *
 * @param {string} day - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchCheckpointsForDay(day) {
    const rows = await fetchCheckpointRowsForDay(day)
    if (!rows.length) return []

    const userIds = rows.flatMap(r => [r.created_by, r.finished_by])
    const usersRows = await fetchUsersByIds(userIds)
    const usersMap = new Map(usersRows.map(u => [u.id, mapUserRef(u)]))

    const withSeq = rows.map((row, idx) => ({ ...mapCheckpointRow(row, usersMap), seq: idx + 1 }))
    await Promise.all(withSeq.map(cp => attachTypeData(cp)))
    return withSeq
}

/**
 * Checkpoint + typspezifische Detaildaten (Busse/Gruppen).
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function fetchCheckpointDetail(id) {
    const row = await fetchCheckpointRowById(id)
    if (!row) return null

    const dayRows = await fetchCheckpointRowsForDay(row.day)
    const seq = dayRows.findIndex(r => r.id === id) + 1

    const usersRows = await fetchUsersByIds([row.created_by, row.finished_by])
    const usersMap = new Map(usersRows.map(u => [u.id, mapUserRef(u)]))

    const cp = { ...mapCheckpointRow(row, usersMap), seq }
    await attachTypeData(cp)
    return cp
}

/**
 * Uebersetzt einen rohen Postgres-RPC-Fehler (doc/db/checkpoints.sql,
 * "Error contract") in die Mock-Fehlerform. Unerwartete Fehler werden NICHT
 * geschluckt, sondern weitergeworfen.
 */
function translateRpcError(error) {
    const code = error?.message
    if (code === 'ALREADY_OPEN') {
        return { error: 'ALREADY_OPEN', existingId: error.details != null ? Number(error.details) : null }
    }
    if (code === 'NOT_OPEN' || code === 'NOT_FINISHED' || code === 'NOT_FOUND' || code === 'NOT_ADMIN' || code === 'BASELINE_ALREADY_SET') {
        return { error: code }
    }
    throw error
}

/**
 * @param {number} type - CHECKPOINT_TYPE.BUS/GROUP/LAZY
 * @param {string} [day]
 * @returns {Promise<Object>} Neue Checkpoint oder { error: 'ALREADY_OPEN', existingId }
 */
export async function createCheckpoint(type, day = todayString()) {
    let row
    try {
        row = await rpcCreateCheckpoint(type, day)
    } catch (error) {
        return translateRpcError(error)
    }
    return fetchCheckpointDetail(row.id)
}

/**
 * @param {number} id
 * @param {boolean} [setBaseline] - presentRoster des Tages fixieren, falls
 *   dies die erste FINISHED Checkpoint des Tages ist (tickets/147/147.txt,
 *   Bestaetigungsdialog).
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_OPEN' }
 */
export async function finishCheckpoint(id, setBaseline = true) {
    let row
    try {
        row = await rpcFinishCheckpoint(id, setBaseline)
    } catch (error) {
        return translateRpcError(error)
    }
    return fetchCheckpointDetail(row.id)
}

/**
 * Nachtraegliche, explizite Fixierung des presentRoster auf einer bereits
 * geschlossenen Checkpoint (tickets/147/147.txt) - fuer den Fall, dass der
 * Admin beim Schliessen abgelehnt hat, oder der Tag noch keine Tagesbasis
 * hat.
 *
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_FINISHED' | 'NOT_FOUND' | 'BASELINE_ALREADY_SET' }
 */
export async function setCheckpointBaseline(id) {
    let row
    try {
        row = await rpcSetCheckpointBaseline(id)
    } catch (error) {
        return translateRpcError(error)
    }
    return fetchCheckpointDetail(row.id)
}

/**
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_FINISHED' | 'ALREADY_OPEN', existingId? }
 */
export async function reopenCheckpoint(id) {
    let row
    try {
        row = await rpcReopenCheckpoint(id)
    } catch (error) {
        return translateRpcError(error)
    }
    return fetchCheckpointDetail(row.id)
}

/**
 * @param {number} id
 * @returns {Promise<Object>} Entfernte Checkpoint oder { error: 'NOT_FOUND' }
 */
export async function removeCheckpoint(id) {
    let row
    try {
        row = await rpcRemoveCheckpoint(id)
    } catch (error) {
        return translateRpcError(error)
    }
    const usersRows = await fetchUsersByIds([row.created_by, row.finished_by])
    const usersMap = new Map(usersRows.map(u => [u.id, mapUserRef(u)]))
    return mapCheckpointRow(row, usersMap)
}

export function isOverdue(cp) {
    return cp.day < todayString() && cp.status === CHECKPOINT_STATUS.OPEN
}

async function computePresentCount(cp) {
    if (cp.type === CHECKPOINT_TYPE.BUS) {
        return cp.buses.filter(b => b.hasData).reduce((sum, b) => sum + b.kinderCount, 0)
    }
    if (cp.type === CHECKPOINT_TYPE.GROUP) {
        return cp.groups.filter(g => g.hasData).reduce((sum, g) => sum + g.current, 0)
    }
    if (cp.type === CHECKPOINT_TYPE.LAZY) {
        const progress = await fetchLazyCheckpointProgress(cp.id)
        return progress.checkedIn.length
    }
    return 0
}

/**
 * Die Checkpoint, die am Tag die Tagesbasis gesetzt hat (die erste
 * FINISHED-Checkpoint des Tages, unabhaengig vom Typ).
 *
 * @param {string} day
 * @returns {Promise<Object|null>}
 */
export async function getDayBaselineCheckpoint(day) {
    const rows = await fetchCheckpointRowsForDay(day)
    const baselineRow = rows.find(r => r.baseline_children_count != null)
    if (!baselineRow) return null
    return fetchCheckpointDetail(baselineRow.id)
}

async function getDayBaseline(day) {
    const cp = await getDayBaselineCheckpoint(day)
    return cp?.baseline_children_count ?? null
}

/**
 * presentRoster eines Tages - die Kinder-Ids, die auf der Tagesbasis-
 * Checkpoint gescannt wurden (dieselbe Auswahl, aus der auch
 * baseline_children_count berechnet wird). null, wenn der Tag noch keine
 * Tagesbasis hat (tickets/147/147.txt).
 *
 * @param {string} day
 * @returns {Promise<Set<number>|null>}
 */
export async function getDayPresentRosterIds(day) {
    const baselineCp = await getDayBaselineCheckpoint(day)
    if (!baselineCp) return null
    const packets = await fetchScanPacketsForCheckpoint(baselineCp.id)
    const scans = await fetchScansForPacketIds(packets.map(p => p.id))
    return new Set(scans.map(s => s.child_id))
}

async function getTotalChildrenCount() {
    const roster = await fetchAllChildren()
    return roster.length
}

/**
 * Ergebnis-Zusammenfassung einer Checkpoint.
 *
 * @param {Object} cp
 * @returns {Promise<{present:number, kinder:?number, betreuer:?number, total:?number, isBaselineCheckpoint:boolean, hasBaseline:boolean, missing:number, extra:number}>}
 */
export async function summarizeCheckpoint(cp) {
    const present = await computePresentCount(cp)
    const result = { present, kinder: null, betreuer: null, total: null }

    if (cp.type === CHECKPOINT_TYPE.BUS) {
        result.kinder = present
        result.betreuer = cp.buses.filter(b => b.hasData).reduce((sum, b) => sum + b.betreuerCount, 0)
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        result.total = await getTotalChildrenCount()
    } else if (cp.type === CHECKPOINT_TYPE.LAZY) {
        const progress = await fetchLazyCheckpointProgress(cp.id)
        result.total = progress.checkedIn.length + progress.notYet.length
    }

    const isBaselineCheckpoint = cp.baseline_children_count != null
    const dayBaseline = isBaselineCheckpoint ? cp.baseline_children_count : await getDayBaseline(cp.day)
    result.isBaselineCheckpoint = isBaselineCheckpoint
    result.hasBaseline = dayBaseline != null
    result.missing = (!isBaselineCheckpoint && dayBaseline != null) ? Math.max(0, dayBaseline - present) : 0
    result.extra = (!isBaselineCheckpoint && dayBaseline != null) ? Math.max(0, present - dayBaseline) : 0

    return result
}

/**
 * Prueft vor dem Schliessen, ob die Checkpoint offene Probleme hat.
 *
 * @param {Object} cp
 * @returns {Promise<{hasIssues:boolean, message:string}>}
 */
export async function checkpointHasOpenIssues(cp) {
    if (cp.type === CHECKPOINT_TYPE.GROUP) {
        const missingTotal = cp.groups.reduce((sum, g) => sum + g.missingChildren.length, 0)
        const noDataGroups = cp.groups.filter(g => !g.hasData).length
        if (missingTotal > 0 || noDataGroups > 0) {
            const parts = []
            if (missingTotal > 0) parts.push(`${missingTotal} Kind(er) fehlen`)
            if (noDataGroups > 0) parts.push(`${noDataGroups} Gruppe(n) ohne Daten`)
            return { hasIssues: true, message: parts.join(', ') + '.' }
        }
    } else if (cp.type === CHECKPOINT_TYPE.BUS) {
        const noDataBuses = cp.buses.filter(b => !b.hasData).length
        if (noDataBuses > 0) {
            return { hasIssues: true, message: `${noDataBuses} Bus(se) haben noch keine Daten gemeldet.` }
        }
    } else if (cp.type === CHECKPOINT_TYPE.LAZY) {
        const progress = await fetchLazyCheckpointProgress(cp.id)
        if (progress.notYet.length > 0) {
            return { hasIssues: true, message: `${progress.notYet.length} Kind(er) haben sich noch nicht gemeldet.` }
        }
    }
    return { hasIssues: false, message: '' }
}

/**
 * Anwesend/fehlend-Aufschluesselung einer BUS-Checkpoint. "Anwesend" ist der
 * tatsaechlich gescannte Bestand (unabhaengig von einer Tagesbasis).
 * "Fehlend" ist das presentRoster des Tages minus "Anwesend" -
 * tickets/147/147.txt: leer, solange der Tag noch keine Tagesbasis hat.
 *
 * @param {Object} cp - muss cp.buses enthalten (fetchCheckpointsForDay()/fetchCheckpointDetail())
 * @returns {Promise<{present:Array, absent:Array}>}
 */
export async function getBusChildrenBreakdown(cp) {
    const roster = await fetchAllChildren()
    const rosterById = new Map(roster.map(c => [c.id, c]))
    const presentIds = new Set(cp.buses.flatMap(b => b.children.map(c => c.id)))

    const present = roster
        .filter(c => presentIds.has(c.id))
        .map(c => ({ id: c.id, name: c.name, groupId: c.group_id }))

    const presentRosterIds = await getDayPresentRosterIds(cp.day)
    const absent = []
    if (presentRosterIds) {
        for (const id of presentRosterIds) {
            if (presentIds.has(id)) continue
            const child = rosterById.get(id)
            if (child) absent.push({ id: child.id, name: child.name, groupId: child.group_id })
        }
    }

    return { present, absent }
}

/**
 * Anwesend/fehlend-Aufschluesselung einer GROUP-Checkpoint. "Anwesend" ist
 * der tatsaechlich gescannte Bestand je Gruppe (group.presentChildIds).
 * "Fehlend" ist das presentRoster des Tages minus "Anwesend" -
 * tickets/147/147.txt: leer, solange der Tag noch keine Tagesbasis hat.
 * Gruppen ohne Daten steuern nur ihren Anteil am presentRoster zu "Fehlend"
 * bei, nicht ihren vollen Bestand.
 *
 * @param {Object} cp - muss cp.groups enthalten
 * @returns {Promise<{present:Array, absent:Array}>}
 */
export async function getGroupChildrenBreakdown(cp) {
    const roster = await fetchAllChildren()
    const presentRosterIds = await getDayPresentRosterIds(cp.day)
    const present = []
    const absent = []

    for (const group of cp.groups) {
        const groupRoster = roster
            .filter(c => c.group_id === group.groupId)
            .map(c => ({ id: c.id, name: c.name, groupId: c.group_id }))

        if (!group.hasData) {
            if (presentRosterIds) {
                absent.push(...groupRoster.filter(c => presentRosterIds.has(c.id)))
            }
            continue
        }

        const presentIds = new Set(group.presentChildIds)
        for (const child of groupRoster) {
            if (presentIds.has(child.id)) {
                present.push(child)
            } else if (presentRosterIds && presentRosterIds.has(child.id)) {
                absent.push(child)
            }
        }
    }
    return { present, absent }
}

/**
 * Abweichung eines einzelnen Busses gegen den Bus gleicher Nummer in der
 * Tagesbasis-Checkpoint.
 *
 * @param {Object} cp
 * @param {number} busNumber
 * @returns {Promise<{hasComparison:boolean, missingCount?:number, extraCount?:number}>}
 */
export async function getBusDelta(cp, busNumber) {
    const baselineCp = await getDayBaselineCheckpoint(cp.day)
    const bus = cp.buses?.find(b => b.busNumber === busNumber)
    if (!baselineCp || baselineCp.id === cp.id || baselineCp.type !== CHECKPOINT_TYPE.BUS || !bus || !bus.hasData) {
        return { hasComparison: false }
    }
    const baselineBus = baselineCp.buses.find(b => b.busNumber === busNumber)
    if (!baselineBus || !baselineBus.hasData) {
        return { hasComparison: false }
    }
    return {
        hasComparison: true,
        missingCount: Math.max(0, baselineBus.kinderCount - bus.kinderCount),
        extraCount: Math.max(0, bus.kinderCount - baselineBus.kinderCount)
    }
}

/**
 * Abweichung einer einzelnen Gruppe gegen dieselbe Gruppe in der
 * Tagesbasis-Checkpoint.
 *
 * @param {Object} cp
 * @param {number} groupId
 * @returns {Promise<{hasComparison:boolean, missingCount?:number, extraCount?:number}>}
 */
export async function getGroupDelta(cp, groupId) {
    const baselineCp = await getDayBaselineCheckpoint(cp.day)
    const group = cp.groups?.find(g => g.groupId === groupId)
    if (!baselineCp || baselineCp.id === cp.id || baselineCp.type !== CHECKPOINT_TYPE.GROUP || !group || !group.hasData) {
        return { hasComparison: false }
    }
    const baselineGroup = baselineCp.groups.find(g => g.groupId === groupId)
    if (!baselineGroup || !baselineGroup.hasData) {
        return { hasComparison: false }
    }
    return {
        hasComparison: true,
        missingCount: Math.max(0, baselineGroup.current - group.current),
        extraCount: Math.max(0, group.current - baselineGroup.current)
    }
}

/**
 * Alle Betreuer einer BUS- oder GROUP-Checkpoint, ueber saemtliche Busse/
 * Gruppen dedupliziert.
 *
 * @param {Object} cp
 * @returns {Array<{id:number,name:string}>}
 */
export function getCheckpointBetreuerList(cp) {
    const byId = new Map()
    if (cp.type === CHECKPOINT_TYPE.BUS) {
        for (const bus of cp.buses) {
            for (const b of bus.betreuer) byId.set(b.id, b)
        }
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        for (const group of cp.groups) {
            for (const b of group.betreuer) byId.set(b.id, b)
        }
    }
    return Array.from(byId.values())
}

async function findCheckpointIdForType(day, type) {
    const rows = await fetchCheckpointRowsForDay(day)
    const ofType = rows.filter(r => r.type === type)
    if (!ofType.length) return null
    const open = ofType.find(r => r.status === CHECKPOINT_STATUS.OPEN)
    if (open) return open.id
    return ofType[ofType.length - 1].id
}

/**
 * Heutige Zuordnung eines Betreuers - liest user_group_day direkt (Spalten
 * group_id/bus_id, tickets/133/133.txt п.5) statt Checkpoints zu
 * durchsuchen wie im Mock. busCheckpointId/groupCheckpointId zeigen auf die
 * aktuell offene Checkpoint des jeweiligen Typs, ersatzweise auf die
 * juengste des Tages, falls keine offen ist.
 *
 * @param {number} betreuerId
 * @param {string} [day]
 * @returns {Promise<{busNumber:?number, busCheckpointId:?number, groupId:?number, groupCheckpointId:?number}>}
 */
export async function getBetreuerTodayAssignment(betreuerId, day = todayString()) {
    const assignment = await fetchUserGroupDayAssignment(betreuerId, day)
    const groupId = assignment?.group_id ?? null
    const busNumber = assignment?.bus_id ?? null

    const [busCheckpointId, groupCheckpointId] = await Promise.all([
        busNumber != null ? findCheckpointIdForType(day, CHECKPOINT_TYPE.BUS) : null,
        groupId != null ? findCheckpointIdForType(day, CHECKPOINT_TYPE.GROUP) : null
    ])

    return { busNumber, busCheckpointId, groupId, groupCheckpointId }
}

function statusOfGroup(group) {
    if (!group.hasData) return 'none'
    if (group.current === group.morning) return 'ok'
    if (group.current < group.morning) return 'missing'
    return 'extra'
}

/**
 * Gesamtsicht auf eine Gruppe fuer einen Tag - reales Pendant zu
 * useGroupEntityMock.fetchGroupEntity() (nicht in 133.txt einzeln benannt,
 * aber noetig fuer GroupEntityView.vue, tickets/133/133.txt Ziel 2; hier statt
 * in einer eigenen Datei, da es ausschliesslich bereits vorhandene
 * Checkpoint-Daten wiederverwendet, wie das Mock-Vorbild).
 *
 * @param {number} groupId
 * @param {string} [day]
 * @returns {Promise<{groupId:number, children:Array, betreuer:Array, currentResult:?Object, dayHistory:Array}>}
 */
export async function fetchGroupEntity(groupId, day = todayString()) {
    const dayCheckpoints = (await fetchCheckpointsForDay(day)).filter(cp => cp.type === CHECKPOINT_TYPE.GROUP)
    const children = await getChildrenByGroup(groupId)

    const betreuerById = new Map()
    const dayHistory = []

    for (const cp of dayCheckpoints) {
        const group = cp.groups.find(g => g.groupId === groupId)
        if (!group) continue

        for (const b of group.betreuer) betreuerById.set(b.id, b)

        dayHistory.push({
            checkpointId: cp.id,
            seq: cp.seq,
            time: cp.finished_at || cp.created_at,
            morning: group.morning,
            current: group.current,
            missingCount: group.hasData ? Math.max(0, group.morning - group.current) : null,
            status: statusOfGroup(group)
        })
    }

    dayHistory.sort((a, b) => new Date(a.time) - new Date(b.time))
    const currentResult = dayHistory.length ? dayHistory[dayHistory.length - 1] : null

    return {
        groupId,
        children,
        betreuer: Array.from(betreuerById.values()),
        currentResult,
        dayHistory
    }
}

export default {
    CHECKPOINT_TYPE,
    CHECKPOINT_STATUS,
    todayString,
    fetchCheckpointsForDay,
    fetchCheckpointDetail,
    createCheckpoint,
    finishCheckpoint,
    setCheckpointBaseline,
    reopenCheckpoint,
    removeCheckpoint,
    isOverdue,
    summarizeCheckpoint,
    checkpointHasOpenIssues,
    getBusChildrenBreakdown,
    getGroupChildrenBreakdown,
    getDayBaselineCheckpoint,
    getDayPresentRosterIds,
    getBusDelta,
    getGroupDelta,
    getCheckpointBetreuerList,
    getBetreuerTodayAssignment,
    fetchGroupEntity
}
