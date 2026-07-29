// src/composables/useCheckpoints.js
// Business-logic layer for the real "Checkpoint" feature (Ticket 131) -
// backed by useSupabaseCheckpoints.js (DB layer) instead of the in-memory
// arrays of useCheckpointsMock.js. Exported function names/shapes are kept
// IDENTICAL to the mock on purpose (that was the mock's whole design
// intent, see tickets/130_2's header comments and tickets/131/
// IMPLEMENTATION_PLAN.md) - the ported views barely change.
//
// One deliberate adaptation vs. the mock: getBusChildrenBreakdown/
// getGroupChildrenBreakdown/getBusDelta/getGroupDelta/
// getCheckpointBetreuerList all require cp.buses/cp.groups to already be
// populated - true only after fetchCheckpointDetail() (never after
// fetchCheckpointsForDay(), which stays lightweight for the list screen).
// This matches how the ported views actually call them (only from the
// Bus/Group/Lazy detail pages, never from the list).
import { supabase } from '@/supabase'
import { useConfigStore } from '@/stores/config'
import { useChildren } from './useChildren'
import { fetchLazyCheckpointProgress } from './useLazyCheckpointProgress'
import {
    fetchCheckpointsForDay as dbFetchCheckpointsForDay,
    fetchCheckpointDetail as dbFetchCheckpointDetail,
    rpcCreateCheckpoint,
    rpcFinishCheckpoint,
    rpcReopenCheckpoint,
    rpcRemoveCheckpoint
} from './useSupabaseCheckpoints'

export const CHECKPOINT_TYPE = { BUS: 1, GROUP: 2, LAZY: 3 }
export const CHECKPOINT_STATUS = { OPEN: 1, FINISHED: 2 }

export function todayString() {
    return new Date().toISOString().split('T')[0]
}

function shapeOriginUser(u) {
    if (!u) return null
    return { id: u.id, name: u.display_name, isAdmin: u.role === 'admin' }
}

function shapeCheckpointRow(row) {
    return {
        id: row.id,
        type: row.type,
        day: row.day,
        status: row.status,
        created_at: row.created_at,
        finished_at: row.finished_at,
        baseline_children_count: row.baseline_children_count,
        created_by: shapeOriginUser(row.created_by_user),
        finished_by: shapeOriginUser(row.finished_by_user)
    }
}

function withSeq(list) {
    return list
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((cp, idx) => ({ ...cp, seq: idx + 1 }))
}

/**
 * @param {string} day - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchCheckpointsForDay(day) {
    const rows = await dbFetchCheckpointsForDay(day)
    return withSeq(rows.map(shapeCheckpointRow))
}

async function fetchCheckpointScanDetails(checkpointId) {
    const { data, error } = await supabase
        .from('scans')
        .select(`
            child_id,
            children!inner(id, name, group_id),
            scan_packets!inner(id, bus_id, group_id, author_id, received_at, children_count, users!inner(id, display_name))
        `)
        .eq('scan_packets.checkpoint_id', checkpointId)

    if (error) {
        console.error('Fehler beim Laden der Checkpoint-Scans:', error)
        throw error
    }
    return data || []
}

async function fetchCheckpointPackets(checkpointId) {
    const { data, error } = await supabase
        .from('scan_packets')
        .select('id, bus_id, group_id, author_id, received_at, children_count, users!inner(id, display_name)')
        .eq('checkpoint_id', checkpointId)
        .order('received_at', { ascending: true })

    if (error) {
        console.error('Fehler beim Laden der Checkpoint-Pakete:', error)
        throw error
    }
    return data || []
}

async function buildBuses(checkpointId) {
    const configStore = useConfigStore()
    const totalBuses = configStore.totalBuses || 0
    const [scanRows, packetRows] = await Promise.all([
        fetchCheckpointScanDetails(checkpointId),
        fetchCheckpointPackets(checkpointId)
    ])

    const buses = []
    for (let busNumber = 1; busNumber <= totalBuses; busNumber++) {
        const rowsForBus = scanRows.filter(r => r.scan_packets.bus_id === busNumber)
        const packetsForBus = packetRows.filter(p => p.bus_id === busNumber)

        const childMap = new Map()
        rowsForBus.forEach(r => childMap.set(r.child_id, { id: r.child_id, name: r.children.name, groupId: r.children.group_id }))

        const betreuerMap = new Map()
        packetsForBus.forEach(p => betreuerMap.set(p.author_id, { id: p.author_id, name: p.users.display_name }))

        buses.push({
            busNumber,
            hasData: packetsForBus.length > 0,
            kinderCount: childMap.size,
            betreuerCount: betreuerMap.size,
            betreuer: Array.from(betreuerMap.values()),
            children: Array.from(childMap.values()),
            packets: packetsForBus.map(p => ({
                id: p.id,
                authorId: p.author_id,
                authorName: p.users.display_name,
                receivedAt: p.received_at,
                childrenCount: p.children_count
            }))
        })
    }
    return buses
}

async function buildGroups(checkpointId) {
    const configStore = useConfigStore()
    const totalGroups = configStore.totalGroups || 0
    const { fetchChildrenByGroup } = useChildren()

    const [scanRows, packetRows, rosters] = await Promise.all([
        fetchCheckpointScanDetails(checkpointId),
        fetchCheckpointPackets(checkpointId),
        Promise.all(Array.from({ length: totalGroups }, (_, i) => fetchChildrenByGroup(i + 1)))
    ])

    const groups = []
    for (let groupId = 1; groupId <= totalGroups; groupId++) {
        const roster = rosters[groupId - 1] || []
        const rowsForGroup = scanRows.filter(r => r.scan_packets.group_id === groupId)
        const packetsForGroup = packetRows.filter(p => p.group_id === groupId)

        const presentIds = new Set(rowsForGroup.map(r => r.child_id))
        const missingChildren = roster
            .filter(c => !presentIds.has(c.id))
            .map(c => ({ id: c.id, name: c.name }))

        const betreuerMap = new Map()
        packetsForGroup.forEach(p => betreuerMap.set(p.author_id, { id: p.author_id, name: p.users.display_name }))

        groups.push({
            groupId,
            hasData: packetsForGroup.length > 0,
            morning: roster.length,
            current: presentIds.size,
            betreuer: Array.from(betreuerMap.values()),
            missingChildren
        })
    }
    return groups
}

/**
 * Checkpoint + typspezifische Detaildaten (Busse/Gruppen), aus scan_packets/
 * scans für genau diese Checkpoint (via checkpoint_id) berechnet.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function fetchCheckpointDetail(id) {
    const row = await dbFetchCheckpointDetail(id)
    if (!row) return null

    const cp = shapeCheckpointRow(row)
    const dayRows = await dbFetchCheckpointsForDay(row.day)
    cp.seq = withSeq(dayRows.map(shapeCheckpointRow)).find(c => c.id === id)?.seq

    if (cp.type === CHECKPOINT_TYPE.BUS) {
        cp.buses = await buildBuses(cp.id)
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        cp.groups = await buildGroups(cp.id)
    }
    return cp
}

/**
 * @param {number} type - CHECKPOINT_TYPE.BUS/GROUP/LAZY
 * @returns {Promise<Object>} Neue Checkpoint oder { error: 'ALREADY_OPEN', existingId }
 */
export async function createCheckpoint(type) {
    const day = todayString()
    try {
        return await rpcCreateCheckpoint(type, day)
    } catch (err) {
        if (String(err.message).includes('ALREADY_OPEN')) {
            const rows = await dbFetchCheckpointsForDay(day)
            const existing = rows.filter(r => r.type === type && r.status === CHECKPOINT_STATUS.OPEN).pop()
            return { error: 'ALREADY_OPEN', existingId: existing?.id }
        }
        throw err
    }
}

/**
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_OPEN' }
 */
export async function finishCheckpoint(id) {
    try {
        return await rpcFinishCheckpoint(id)
    } catch (err) {
        if (String(err.message).includes('NOT_OPEN')) {
            return { error: 'NOT_OPEN' }
        }
        throw err
    }
}

/**
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_FINISHED' | 'ALREADY_OPEN', existingId? }
 */
export async function reopenCheckpoint(id) {
    try {
        return await rpcReopenCheckpoint(id)
    } catch (err) {
        const msg = String(err.message)
        if (msg.includes('NOT_FINISHED')) {
            return { error: 'NOT_FINISHED' }
        }
        if (msg.includes('ALREADY_OPEN')) {
            const cp = await dbFetchCheckpointDetail(id)
            const rows = await dbFetchCheckpointsForDay(cp.day)
            const existing = rows.filter(r => r.type === cp.type && r.status === CHECKPOINT_STATUS.OPEN).pop()
            return { error: 'ALREADY_OPEN', existingId: existing?.id }
        }
        throw err
    }
}

/**
 * Löscht die Checkpoint UND alle ihre scan_packets/scans (remove_checkpoint(),
 * kaskadierend, siehe doc/db/checkpoints_functions.sql) - keine Archivierung,
 * anders als der Mock (dessen removedCheckpoints-Archiv keine reale
 * Entsprechung hat, da hier tatsächlich gelöscht statt verschoben wird).
 *
 * @param {number} id
 */
export async function removeCheckpoint(id) {
    await rpcRemoveCheckpoint(id)
}

export function isOverdue(cp) {
    return cp.day < todayString() && cp.status === CHECKPOINT_STATUS.OPEN
}

/**
 * Tagesbasis-Checkpoint (die erste FINISHED-Checkpoint des Tages,
 * unabhängig vom Typ) - liefert null, solange noch keine geschlossen wurde.
 *
 * @param {string} day
 * @returns {Promise<Object|null>}
 */
export async function getDayBaselineCheckpoint(day) {
    const rows = await dbFetchCheckpointsForDay(day)
    const found = rows.find(r => r.baseline_children_count != null)
    return found ? shapeCheckpointRow(found) : null
}

async function computePresentCount(cp) {
    if (cp.type === CHECKPOINT_TYPE.LAZY) {
        const progress = await fetchLazyCheckpointProgress(cp.id)
        return progress.checkedIn.length
    }
    const { data, error } = await supabase
        .from('scans')
        .select('child_id, scan_packets!inner(checkpoint_id)')
        .eq('scan_packets.checkpoint_id', cp.id)
    if (error) throw error
    return new Set((data || []).map(r => r.child_id)).size
}

/**
 * @param {Object} cp
 * @returns {Promise<{present:number, kinder:?number, betreuer:?number, total:?number, isBaselineCheckpoint:boolean, hasBaseline:boolean, missing:number, extra:number}>}
 */
export async function summarizeCheckpoint(cp) {
    const present = await computePresentCount(cp)
    const result = { present, kinder: null, betreuer: null, total: null }

    if (cp.type === CHECKPOINT_TYPE.BUS) {
        result.kinder = present
        const { data, error } = await supabase.from('scan_packets').select('author_id').eq('checkpoint_id', cp.id)
        if (error) throw error
        result.betreuer = new Set((data || []).map(r => r.author_id)).size
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        const { fetchAllChildren } = useChildren()
        result.total = (await fetchAllChildren()).length
    } else if (cp.type === CHECKPOINT_TYPE.LAZY) {
        const progress = await fetchLazyCheckpointProgress(cp.id)
        result.total = progress.checkedIn.length + progress.notYet.length
    }

    const baselineCp = cp.baseline_children_count != null ? null : await getDayBaselineCheckpoint(cp.day)
    const isBaselineCheckpoint = cp.baseline_children_count != null
    const dayBaseline = isBaselineCheckpoint ? cp.baseline_children_count : (baselineCp?.baseline_children_count ?? null)
    result.isBaselineCheckpoint = isBaselineCheckpoint
    result.hasBaseline = dayBaseline != null
    result.missing = (!isBaselineCheckpoint && dayBaseline != null) ? Math.max(0, dayBaseline - present) : 0
    result.extra = (!isBaselineCheckpoint && dayBaseline != null) ? Math.max(0, present - dayBaseline) : 0

    return result
}

/**
 * @param {Object} cp - muss über fetchCheckpointDetail() geladen sein (cp.buses/cp.groups populiert)
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
 * @param {Object} cp - muss über fetchCheckpointDetail() geladen sein
 * @returns {Promise<{present:Array, absent:Array}>}
 */
export async function getBusChildrenBreakdown(cp) {
    const { fetchAllChildren } = useChildren()
    const all = await fetchAllChildren()
    const presentIds = new Set((cp.buses || []).flatMap(b => b.children.map(c => c.id)))
    const present = []
    const absent = []
    for (const child of all) {
        const entry = { id: child.id, name: child.name, groupId: child.group_id }
        if (presentIds.has(child.id)) present.push(entry)
        else absent.push(entry)
    }
    return { present, absent }
}

/**
 * @param {Object} cp - muss über fetchCheckpointDetail() geladen sein
 * @returns {Promise<{present:Array, absent:Array}>}
 */
export async function getGroupChildrenBreakdown(cp) {
    const { fetchChildrenByGroup } = useChildren()
    const present = []
    const absent = []
    for (const group of (cp.groups || [])) {
        const roster = await fetchChildrenByGroup(group.groupId)
        if (!group.hasData) {
            absent.push(...roster.map(c => ({ id: c.id, name: c.name, groupId: group.groupId })))
            continue
        }
        const missingSet = new Set(group.missingChildren.map(c => c.id))
        for (const child of roster) {
            const entry = { id: child.id, name: child.name, groupId: group.groupId }
            if (missingSet.has(child.id)) absent.push(entry)
            else present.push(entry)
        }
    }
    return { present, absent }
}

/**
 * @param {Object} cp - muss über fetchCheckpointDetail() geladen sein (cp.buses populiert)
 * @param {number} busNumber
 * @returns {Promise<{hasComparison:boolean, missingCount?:number, extraCount?:number}>}
 */
export async function getBusDelta(cp, busNumber) {
    const baselineRow = await getDayBaselineCheckpoint(cp.day)
    const bus = cp.buses?.find(b => b.busNumber === busNumber)
    if (!baselineRow || baselineRow.id === cp.id || baselineRow.type !== CHECKPOINT_TYPE.BUS || !bus || !bus.hasData) {
        return { hasComparison: false }
    }
    const baselineCp = await fetchCheckpointDetail(baselineRow.id)
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
 * @param {Object} cp - muss über fetchCheckpointDetail() geladen sein (cp.groups populiert)
 * @param {number} groupId
 * @returns {Promise<{hasComparison:boolean, missingCount?:number, extraCount?:number}>}
 */
export async function getGroupDelta(cp, groupId) {
    const baselineRow = await getDayBaselineCheckpoint(cp.day)
    const group = cp.groups?.find(g => g.groupId === groupId)
    if (!baselineRow || baselineRow.id === cp.id || baselineRow.type !== CHECKPOINT_TYPE.GROUP || !group || !group.hasData) {
        return { hasComparison: false }
    }
    const baselineCp = await fetchCheckpointDetail(baselineRow.id)
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
 * @param {Object} cp - muss über fetchCheckpointDetail() geladen sein
 * @returns {Array<{id:number,name:string}>}
 */
export function getCheckpointBetreuerList(cp) {
    const byId = new Map()
    if (cp.type === CHECKPOINT_TYPE.BUS) {
        for (const bus of (cp.buses || [])) {
            for (const b of bus.betreuer) byId.set(b.id, b)
        }
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        for (const group of (cp.groups || [])) {
            for (const b of group.betreuer) byId.set(b.id, b)
        }
    }
    return Array.from(byId.values())
}

/**
 * Heutige Zuordnung eines Betreuers, aus scan_packets abgeleitet (letzter
 * Bus-/Gruppen-Pakete-Autor heute) - unabhängig von cp.buses/cp.groups, nur
 * eine leichte Direktabfrage.
 *
 * @param {number} betreuerId
 * @param {string} [day]
 * @returns {Promise<{busNumber:?number, busCheckpointId:?number, groupId:?number, groupCheckpointId:?number}>}
 */
export async function getBetreuerTodayAssignment(betreuerId, day = todayString()) {
    const { data, error } = await supabase
        .from('scan_packets')
        .select('bus_id, group_id, type, checkpoint_id, received_at')
        .eq('date', day)
        .eq('author_id', betreuerId)
        .order('received_at', { ascending: false })

    if (error) throw error

    const busRow = (data || []).find(r => r.type === CHECKPOINT_TYPE.BUS)
    const groupRow = (data || []).find(r => r.type === CHECKPOINT_TYPE.GROUP)

    return {
        busNumber: busRow?.bus_id ?? null,
        busCheckpointId: busRow?.checkpoint_id ?? null,
        groupId: groupRow?.group_id ?? null,
        groupCheckpointId: groupRow?.checkpoint_id ?? null
    }
}

export default {
    CHECKPOINT_TYPE,
    CHECKPOINT_STATUS,
    todayString,
    fetchCheckpointsForDay,
    createCheckpoint,
    finishCheckpoint,
    reopenCheckpoint,
    removeCheckpoint,
    fetchCheckpointDetail,
    isOverdue,
    summarizeCheckpoint,
    checkpointHasOpenIssues,
    getBusChildrenBreakdown,
    getGroupChildrenBreakdown,
    getDayBaselineCheckpoint,
    getBusDelta,
    getGroupDelta,
    getCheckpointBetreuerList,
    getBetreuerTodayAssignment
}
