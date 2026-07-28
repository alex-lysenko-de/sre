// src/composables/useCheckpointsMock.js
// Mock-Datenschicht fuer den Checkpoint-Prototypen (Ticket 130_2). Bewusst
// KEIN Pinia-Store (siehe tickets/130_2/IMPLEMENTATION_PLAN.md, "Risiken") -
// ein module-level reactive-Singleton, damit im Baum klar bleibt, dass dies
// kein produktiver Domain-Layer ist. Namen/Form der Funktionen und Objekte
// folgen bewusst der Spezifikation des zukuenftigen useCheckpoints.js aus
// tickets/130/IMPLEMENTATION_PLAN.md, damit Ticket 131 nur die Datenquelle
// austauschen muss (Mock -> Supabase), ohne die Views neu zu schreiben.
//
// Keine einzige Netzwerkanfrage, kein Supabase-Import. Alle Funktionen sind
// async/Promise-basiert wie das zukuenftige Pendant, loesen aber sofort auf.
//
// UX-Feedback-Runde 1 (siehe tickets/130_2/UX_FEEDBACK.md): "Cancel" wurde
// durch die Nutzerin als verwirrend empfunden (Abgebrochen sah visuell wie
// Abgeschlossen aus, blieb aber sichtbar in der Liste). Ersetzt durch zwei
// klar getrennte Aktionen: reopenCheckpoint() (Gegenteil von finish, fuer
// versehentliches Schliessen) und removeCheckpoint() (entfernt eine
// irrtuemlich angelegte Checkpoint komplett aus der sichtbaren Liste, statt
// sie mit einem verwirrenden Status weiterzufuehren). CHECKPOINT_STATUS hat
// dadurch nur noch OPEN/FINISHED - CANCELLED entfaellt ersatzlos.
//
// UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung): der Kinder-Pool
// (vormals private CHILD_NAMES/GROUP_ROSTER/CHILD_GROUP_MAP) und der
// Betreuer-Pool (vormals BETREUER_NAME_POOL) sind jetzt kanonische Roster
// mit stabiler Id in useChildEntityMock.js/useBetreuerEntityMock.js -
// Kinder/Betreuer sind eigene Entitaeten mit eigener Karte/Route und werden
// ueberall (Bus, Gruppe, Breakdown) per Id statt per Name referenziert.

import { reactive } from 'vue'
import { fetchLazyCheckpointProgress } from './useLazyCheckpointProgressMock'
import { MOCK_TOTAL_BUSES, MOCK_TOTAL_GROUPS } from './useMockConstants'
import { CHILD_ROSTER, getChildrenByGroup } from './useChildEntityMock'
import { BETREUER_ROSTER } from './useBetreuerEntityMock'

export const CHECKPOINT_TYPE = { BUS: 1, GROUP: 2, LAZY: 3 }
export const CHECKPOINT_STATUS = { OPEN: 1, FINISHED: 2 }

const ADMIN_USER = { id: 1, name: 'Hauptadministrator', isAdmin: true }
const BETREUER_MUELLER = { id: 101, name: 'Müller', isAdmin: false }
const BETREUER_SCHMIDT = { id: 102, name: 'Schmidt', isAdmin: false }
const BETREUER_FISCHER = { id: 103, name: 'Fischer', isAdmin: false }

export function todayString() {
    return new Date().toISOString().split('T')[0]
}

function timeToday(hours, minutes) {
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return d.toISOString()
}

let nextId = 1

function makeId() {
    return nextId++
}

// Kurzform {id,name} eines Roster-Eintrags fuer Checkpoint-Schnappschuesse
// (Bus/Gruppe) - dort wird bewusst nicht der volle Betreuer/Kind-Datensatz
// (email/phone/age/...) kopiert, nur die zum Verlinken noetigen Felder.
function shortRef(entity) {
    return { id: entity.id, name: entity.name }
}

function buildBusesMock({ allReceived, includeEmptyBus }) {
    const buses = []
    for (let busNumber = 1; busNumber <= MOCK_TOTAL_BUSES; busNumber++) {
        // Ein Bus zeigt bewusst den Zustand "keine Kinder zugeordnet"
        // (130_2.txt, "fehlende Kinder"-Zustand), unabhaengig vom Status.
        const isEmptyBus = includeEmptyBus && busNumber === MOCK_TOTAL_BUSES
        const hasData = allReceived ? !isEmptyBus : (busNumber % 2 === 1 && !isEmptyBus)

        const kinderCount = hasData ? 4 + (busNumber % 3) : 0
        // UX-Feedback: ein Bus kann mehr als einen, oft > 8 Betreuer haben -
        // ein Bus (Nr. 1) demonstriert das explizit.
        const betreuerCount = hasData ? (busNumber === 1 ? 9 : 1) : 0
        const betreuer = hasData
            ? Array.from({ length: betreuerCount }, (_, i) => shortRef(BETREUER_ROSTER[(busNumber - 1 + i) % BETREUER_ROSTER.length]))
            : []

        const children = hasData
            ? CHILD_ROSTER.slice((busNumber * 3) % CHILD_ROSTER.length).slice(0, kinderCount)
                .map(c => ({ id: c.id, name: c.name, groupId: c.groupId }))
            : []

        const packets = hasData ? betreuer.map((author, i) => ({
            id: makeId(),
            authorId: author.id,
            authorName: author.name,
            receivedAt: timeToday(9, (busNumber * 5 + i * 3) % 60),
            childrenCount: Math.max(1, Math.round(kinderCount / betreuer.length))
        })) : []

        buses.push({ busNumber, hasData, kinderCount, betreuerCount, betreuer, children, packets })
    }
    return buses
}

function buildGroupsMock({ allComplete }) {
    const betreuerPool = [BETREUER_MUELLER, BETREUER_SCHMIDT, BETREUER_FISCHER]
    const groups = []
    for (let groupId = 1; groupId <= MOCK_TOTAL_GROUPS; groupId++) {
        const roster = getChildrenByGroup(groupId)
        const morning = roster.length

        // Gruppe 1: keine Daten ("keine Kinder"-Zustand). Gruppe 2: fehlende
        // Kinder (Differenz > 0). Gruppe 3: mehr Kinder als am Morgen (Kind
        // kam spaeter dazu, UX-Feedback explizit gefordert). Alle anderen:
        // vollstaendig sauber.
        let hasData = true
        let current = morning
        let missingChildren = []

        if (groupId === 1) {
            hasData = false
            current = 0
        } else if (groupId === 2 && !allComplete) {
            current = Math.max(0, morning - 2)
            missingChildren = roster.slice(current).map(shortRef)
        } else if (groupId === 3 && !allComplete) {
            current = morning + 1
        }

        groups.push({
            groupId,
            hasData,
            morning,
            current,
            betreuer: hasData ? [shortRef(betreuerPool[groupId % betreuerPool.length])] : [],
            missingChildren
        })
    }
    return groups
}

const checkpoints = reactive([])
// Archiv fuer entfernte (Remove) Checkpoints - erscheinen nicht mehr in
// fetchCheckpointsForDay(), bleiben aber erhalten statt geloescht zu werden.
// Aktuell von keinem Bildschirm gelesen (kein Archiv-UI in diesem
// Feedback-Zyklus gefordert) - Funktion liegt bereit fuer eine spaetere
// Archiv-Ansicht.
const removedCheckpoints = reactive([])

function seed() {
    // 1. Bus FINISHED - heute Morgen, automatisch durch ersten Bus-Packet
    //    erstellt (deckt die erste finish_checkpoint()-Baseline ab).
    // UX-Feedback Runde 3: die Tagesbasis ist keine freistehende Mock-Zahl
    // mehr, sondern die tatsaechlich in dieser (ersten) Checkpoint gezaehlte
    // Kinderzahl - dieselbe Regel wie in finishCheckpoint().
    const finishedBusBuses = buildBusesMock({ allReceived: true, includeEmptyBus: false })
    const finishedBus = {
        id: makeId(),
        type: CHECKPOINT_TYPE.BUS,
        day: todayString(),
        status: CHECKPOINT_STATUS.FINISHED,
        created_by: BETREUER_MUELLER,
        created_at: timeToday(9, 0),
        finished_at: timeToday(9, 5),
        finished_by: ADMIN_USER,
        baseline_children_count: finishedBusBuses.reduce((sum, b) => sum + b.kinderCount, 0),
        buses: finishedBusBuses
    }
    checkpoints.push(finishedBus)

    // 2. Bus OPEN - laeuft parallel zu Group OPEN (decision.md, Punkt 3).
    checkpoints.push({
        id: makeId(),
        type: CHECKPOINT_TYPE.BUS,
        day: todayString(),
        status: CHECKPOINT_STATUS.OPEN,
        created_by: BETREUER_SCHMIDT,
        created_at: timeToday(9, 20),
        finished_at: null,
        finished_by: null,
        baseline_children_count: null,
        buses: buildBusesMock({ allReceived: false, includeEmptyBus: true })
    })

    // 3. Group OPEN - gleichzeitig mit #2 offen, kein Konflikt.
    checkpoints.push({
        id: makeId(),
        type: CHECKPOINT_TYPE.GROUP,
        day: todayString(),
        status: CHECKPOINT_STATUS.OPEN,
        created_by: BETREUER_FISCHER,
        created_at: timeToday(9, 15),
        finished_at: null,
        finished_by: null,
        baseline_children_count: null,
        groups: buildGroupsMock({ allComplete: false })
    })

    // 4. Group OPEN (Anomalie) - zweite gleichzeitig offene Group-Checkpoint.
    //    Wird NUR hier geseedet, niemals durch eine Nutzeraktion erzeugbar
    //    (decision.md, Punkt 6: UI darf diesen Zustand nicht erzeugen
    //    koennen, muss ihn aber anzeigen koennen, falls er in den Daten ist).
    checkpoints.push({
        id: makeId(),
        type: CHECKPOINT_TYPE.GROUP,
        day: todayString(),
        status: CHECKPOINT_STATUS.OPEN,
        created_by: BETREUER_FISCHER,
        created_at: timeToday(9, 16),
        finished_at: null,
        finished_by: null,
        baseline_children_count: null,
        groups: buildGroupsMock({ allComplete: true })
    })

    // 5. Lazy FINISHED - explizit durch Admin erstellt und beendet.
    checkpoints.push({
        id: makeId(),
        type: CHECKPOINT_TYPE.LAZY,
        day: todayString(),
        status: CHECKPOINT_STATUS.FINISHED,
        created_by: ADMIN_USER,
        created_at: timeToday(12, 45),
        finished_at: timeToday(13, 0),
        finished_by: ADMIN_USER,
        baseline_children_count: null
    })
}

seed()

function withSeq(list) {
    return list
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((cp, idx) => ({ ...cp, seq: idx + 1 }))
}

/**
 * Liste/Historie der Checkpoints eines Tages, inkl. berechneter
 * fortlaufender Nummer (seq) - wird nicht gespeichert, sondern wie im
 * echten Plan (ROW_NUMBER() OVER (PARTITION BY day ORDER BY id)) beim Lesen
 * berechnet. Entfernte (removeCheckpoint()) Checkpoints tauchen hier nicht
 * mehr auf.
 *
 * @param {string} day - Datum im Format YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchCheckpointsForDay(day) {
    return withSeq(checkpoints.filter(cp => cp.day === day))
}

/**
 * Entspricht der Semantik der zukuenftigen RPC create_checkpoint(): explizite
 * Erstellung durch den Administrator wird abgelehnt, wenn bereits eine
 * offene Checkpoint desselben Typs existiert (decision.md, Punkt 4) - anders
 * als das automatische Anlegen durch submit_scan_packet(), das hier nicht
 * simuliert wird.
 *
 * @param {number} type - CHECKPOINT_TYPE.BUS/GROUP/LAZY
 * @returns {Promise<Object>} Neue Checkpoint oder { error: 'ALREADY_OPEN', existingId }
 */
export async function createCheckpoint(type) {
    const day = todayString()
    const openOfType = checkpoints.filter(cp => cp.day === day && cp.type === type && cp.status === CHECKPOINT_STATUS.OPEN)

    if (openOfType.length > 0) {
        return { error: 'ALREADY_OPEN', existingId: openOfType[openOfType.length - 1].id }
    }

    const cp = {
        id: makeId(),
        type,
        day,
        status: CHECKPOINT_STATUS.OPEN,
        created_by: ADMIN_USER,
        created_at: new Date().toISOString(),
        finished_at: null,
        finished_by: null,
        baseline_children_count: null
    }

    if (type === CHECKPOINT_TYPE.BUS) {
        cp.buses = buildBusesMock({ allReceived: false, includeEmptyBus: false })
    } else if (type === CHECKPOINT_TYPE.GROUP) {
        cp.groups = buildGroupsMock({ allComplete: false })
    }

    checkpoints.push(cp)
    return cp
}

/**
 * Einziger Weg, eine Checkpoint zu schliessen (decision.md, Punkt 2) - kein
 * Auto-Finish, auch nicht fuer Lazy. Setzt baseline_children_count nur bei
 * der ersten FINISHED-Checkpoint des Tages (unabhaengig vom Typ).
 *
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_OPEN' }
 */
export async function finishCheckpoint(id) {
    const cp = checkpoints.find(c => c.id === id)
    if (!cp || cp.status !== CHECKPOINT_STATUS.OPEN) {
        return { error: 'NOT_OPEN' }
    }

    cp.status = CHECKPOINT_STATUS.FINISHED
    cp.finished_at = new Date().toISOString()
    cp.finished_by = ADMIN_USER

    if (getDayBaseline(cp.day) == null) {
        cp.baseline_children_count = await computePresentCount(cp)
    }

    return cp
}

/**
 * Gegenteil von finishCheckpoint() - fuer versehentlich geschlossene
 * Checkpoints (UX-Feedback Runde 1). Nur fuer FINISHED moeglich. Da pro Typ
 * und Tag nur eine OFFENE Checkpoint erlaubt ist (decision.md, Punkt 4),
 * wird das Wiedereroeffnen abgelehnt, falls in der Zwischenzeit bereits eine
 * andere Checkpoint desselben Typs geoeffnet wurde - gleiche Fehlerform wie
 * createCheckpoint().
 *
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_FINISHED' | 'ALREADY_OPEN', existingId? }
 */
export async function reopenCheckpoint(id) {
    const cp = checkpoints.find(c => c.id === id)
    if (!cp || cp.status !== CHECKPOINT_STATUS.FINISHED) {
        return { error: 'NOT_FINISHED' }
    }

    const openOfType = checkpoints.filter(c => c.day === cp.day && c.type === cp.type && c.status === CHECKPOINT_STATUS.OPEN)
    if (openOfType.length > 0) {
        return { error: 'ALREADY_OPEN', existingId: openOfType[openOfType.length - 1].id }
    }

    cp.status = CHECKPOINT_STATUS.OPEN
    cp.finished_at = null
    cp.finished_by = null

    return cp
}

/**
 * Entfernt eine irrtuemlich angelegte Checkpoint vollstaendig aus der
 * sichtbaren Liste (ersetzt das verwirrende "Cancel" aus Runde 1 des
 * UX-Feedbacks). Die Bestaetigung ("wirklich entfernen?") liegt beim
 * aufrufenden UI, nicht hier. Die Checkpoint wird nicht geloescht, sondern
 * in ein Archiv verschoben (siehe removedCheckpoints) - falls spaeter eine
 * Archiv-Ansicht gewuenscht wird, ist die Information noch vorhanden.
 *
 * @param {number} id
 * @returns {Promise<Object>} Entfernte Checkpoint oder { error: 'NOT_FOUND' }
 */
export async function removeCheckpoint(id) {
    const idx = checkpoints.findIndex(c => c.id === id)
    if (idx === -1) {
        return { error: 'NOT_FOUND' }
    }

    const [cp] = checkpoints.splice(idx, 1)
    cp.removed_at = new Date().toISOString()
    cp.removed_by = ADMIN_USER
    removedCheckpoints.push(cp)

    return cp
}

/**
 * Archiv der entfernten Checkpoints eines Tages - aktuell ohne eigenes UI,
 * siehe removedCheckpoints.
 *
 * @param {string} day
 * @returns {Promise<Array>}
 */
export async function fetchRemovedCheckpointsForDay(day) {
    return removedCheckpoints.filter(cp => cp.day === day)
}

/**
 * Checkpoint + typspezifische synthetische Detaildaten (Busse/Gruppen).
 * Fuer LAZY liefert dies nur die Checkpoint selbst - die Fortschrittsdaten
 * kommen aus useLazyCheckpointProgressMock.js.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function fetchCheckpointDetail(id) {
    const cp = checkpoints.find(c => c.id === id)
    if (!cp) return null

    const seq = withSeq(checkpoints.filter(c => c.day === cp.day)).find(c => c.id === id)?.seq
    return { ...cp, seq }
}

export function isOverdue(cp) {
    return cp.day < todayString() && cp.status === CHECKPOINT_STATUS.OPEN
}

// UX-Feedback Runde 3: Kartenliste (Page 1) und Detail-Kopf (Page 2/3/4,
// EL2) zeigten bisher nur Zeiten/Status, kein Ergebnis. Ab hier: Hilfen, um
// das Ergebnis (Kinder-/Betreuerzahl, Abweichung zur Tagesbasis) zu
// berechnen, das Schliessen bei offenen Problemen zu warnen, und
// anwesend/fehlend-Listen fuer die Zwischenablage aufzuschluesseln.

/**
 * Anzahl der als "anwesend" gezaehlten Kinder einer Checkpoint - je nach Typ
 * aus buses/groups direkt lesbar, bei LAZY aus der separaten
 * Fortschritts-Mock-Datenquelle (useLazyCheckpointProgressMock.js).
 *
 * @param {Object} cp
 * @returns {Promise<number>}
 */
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
 * FINISHED-Checkpoint des Tages, unabhaengig vom Typ - siehe
 * finishCheckpoint()). Liefert null, solange noch keine Checkpoint des
 * Tages geschlossen wurde. Anders als die reine Zahl (getDayBaseline())
 * wird hier die ganze Checkpoint gebraucht, um pro-Bus/pro-Gruppe
 * vergleichen zu koennen (getBusDelta()/getGroupDelta()).
 *
 * @param {string} day
 * @returns {Object|null}
 */
export function getDayBaselineCheckpoint(day) {
    return checkpoints.find(c => c.day === day && c.baseline_children_count != null) || null
}

/**
 * Basiszahl des Tages - duenner Wrapper um getDayBaselineCheckpoint() fuer
 * bestehende Aufrufstellen (summarizeCheckpoint()), die nur die Zahl
 * brauchen.
 *
 * @param {string} day
 * @returns {number|null}
 */
function getDayBaseline(day) {
    return getDayBaselineCheckpoint(day)?.baseline_children_count ?? null
}

/**
 * Ergebnis-Zusammenfassung einer Checkpoint fuer Kartenansicht (Page 1) und
 * Detail-Kopf (Page 2/3/4, EL2). Fuer BUS zusaetzlich die Betreuer-Summe;
 * fuer alle Typen der Abgleich gegen die Tagesbasis (getDayBaseline()),
 * sofern diese Checkpoint nicht selbst die Basis gesetzt hat.
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
        result.total = CHILD_ROSTER.length
    } else if (cp.type === CHECKPOINT_TYPE.LAZY) {
        const progress = await fetchLazyCheckpointProgress(cp.id)
        result.total = progress.checkedIn.length + progress.notYet.length
    }

    const isBaselineCheckpoint = cp.baseline_children_count != null
    const dayBaseline = isBaselineCheckpoint ? cp.baseline_children_count : getDayBaseline(cp.day)
    result.isBaselineCheckpoint = isBaselineCheckpoint
    result.hasBaseline = dayBaseline != null
    result.missing = (!isBaselineCheckpoint && dayBaseline != null) ? Math.max(0, dayBaseline - present) : 0
    result.extra = (!isBaselineCheckpoint && dayBaseline != null) ? Math.max(0, present - dayBaseline) : 0

    return result
}

/**
 * Prueft vor dem Schliessen, ob die Checkpoint offene Probleme hat (fehlende
 * Kinder/Busse/Gruppen ohne Daten) - UX-Feedback Runde 3: Schliessen ohne
 * Warnung wurde als falsch empfunden. Die aufrufende View zeigt bei
 * hasIssues=true einen Bestaetigungsdialog, bevor finishCheckpoint()
 * aufgerufen wird.
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
 * Anwesend/fehlend-Aufschluesselung einer BUS-Checkpoint gegen den vollen
 * Kinder-Roster (CHILD_ROSTER) - UX-Feedback Runde 3, Punkt 4 (kopierbare
 * Listen). "Fehlend" schliesst auch Kinder aus Bussen ohne Daten ein. Jeder
 * Eintrag traegt seit Runde 4 eine id, damit die aufrufende Liste zur
 * Kind-Karte verlinken kann.
 *
 * @param {Object} cp
 * @returns {{present:Array<{id:number,name:string,groupId:number}>, absent:Array<{id:number,name:string,groupId:number}>}}
 */
export function getBusChildrenBreakdown(cp) {
    const presentIds = new Set(cp.buses.flatMap(b => b.children.map(c => c.id)))
    const present = []
    const absent = []
    for (const child of CHILD_ROSTER) {
        const entry = { id: child.id, name: child.name, groupId: child.groupId }
        if (presentIds.has(child.id)) {
            present.push(entry)
        } else {
            absent.push(entry)
        }
    }
    return { present, absent }
}

/**
 * Anwesend/fehlend-Aufschluesselung einer GROUP-Checkpoint - Gruppen ohne
 * Daten (hasData=false) zaehlen komplett als "fehlend" (unbestaetigt), siehe
 * UX-Feedback Runde 3, Punkt 4. Ids seit Runde 4 fuer die Kind-Karten-Links.
 *
 * @param {Object} cp
 * @returns {{present:Array<{id:number,name:string,groupId:number}>, absent:Array<{id:number,name:string,groupId:number}>}}
 */
export function getGroupChildrenBreakdown(cp) {
    const present = []
    const absent = []
    for (const group of cp.groups) {
        const roster = getChildrenByGroup(group.groupId)
        if (!group.hasData) {
            absent.push(...roster.map(c => ({ id: c.id, name: c.name, groupId: group.groupId })))
            continue
        }
        const missingSet = new Set(group.missingChildren.map(c => c.id))
        for (const child of roster) {
            const entry = { id: child.id, name: child.name, groupId: group.groupId }
            if (missingSet.has(child.id)) {
                absent.push(entry)
            } else {
                present.push(entry)
            }
        }
    }
    return { present, absent }
}

// UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung): Bus/Gruppe
// bekommen eigene Karten (Bus-Zahl-Links, Gruppen-Link) mit Abweichung
// gegen die Tagesbasis auf ihrer eigenen Ebene (nicht nur aggregiert ueber
// die ganze Checkpoint wie summarizeCheckpoint() das schon tut).

/**
 * Abweichung eines einzelnen Busses gegen den Bus gleicher Nummer in der
 * Tagesbasis-Checkpoint. Liefert hasComparison:false, wenn kein Vergleich
 * moeglich ist (noch keine Tagesbasis, Basis ist keine BUS-Checkpoint, diese
 * Checkpoint ist selbst die Basis, oder einer der beiden Busse hat keine
 * Daten) - bewusst kein Crash bei unpassendem Basistyp.
 *
 * @param {Object} cp
 * @param {number} busNumber
 * @returns {{hasComparison:boolean, missingCount?:number, extraCount?:number}}
 */
export function getBusDelta(cp, busNumber) {
    const baselineCp = getDayBaselineCheckpoint(cp.day)
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
 * Tagesbasis-Checkpoint - Gegenstueck zu getBusDelta() fuer GROUP-
 * Checkpoints.
 *
 * @param {Object} cp
 * @param {number} groupId
 * @returns {{hasComparison:boolean, missingCount?:number, extraCount?:number}}
 */
export function getGroupDelta(cp, groupId) {
    const baselineCp = getDayBaselineCheckpoint(cp.day)
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
 * Gruppen dedupliziert - fuer die aggregierte "Betreuer gesamt"-Liste auf
 * der Bus-/Group-Checkpoint-Seite (Punkt 2 des Runde-4-Feedbacks: EL2 muss
 * auch die Betreuerzahl zeigen, nicht nur die Kinderzahl).
 *
 * @param {Object} cp
 * @returns {Array<{id:number,name:string}>}
 */
export function getCheckpointBetreuerList(cp) {
    const byId = new Map()
    if (cp.type === CHECKPOINT_TYPE.BUS) {
        for (const bus of cp.buses) {
            for (const b of bus.betreuer) {
                byId.set(b.id, b)
            }
        }
    } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
        for (const group of cp.groups) {
            for (const b of group.betreuer) {
                byId.set(b.id, b)
            }
        }
    }
    return Array.from(byId.values())
}

/**
 * Heutige Zuordnung eines Betreuers - welchem Bus/welcher Gruppe er/sie in
 * den heutigen Checkpoints zugeordnet ist (fuer die neue Betreuer-Karte,
 * Punkt 7 des Runde-4-Feedbacks). Rein aus den bereits erzeugten
 * Checkpoint-Daten abgeleitet, keine neue Zuordnungslogik.
 *
 * @param {number} betreuerId
 * @param {string} [day]
 * @returns {{busNumber:?number, busCheckpointId:?number, groupId:?number, groupCheckpointId:?number}}
 */
export function getBetreuerTodayAssignment(betreuerId, day = todayString()) {
    let busNumber = null
    let busCheckpointId = null
    let groupId = null
    let groupCheckpointId = null

    for (const cp of checkpoints.filter(c => c.day === day)) {
        if (cp.type === CHECKPOINT_TYPE.BUS) {
            const bus = cp.buses.find(b => b.betreuer.some(x => x.id === betreuerId))
            if (bus) {
                busNumber = bus.busNumber
                busCheckpointId = cp.id
            }
        } else if (cp.type === CHECKPOINT_TYPE.GROUP) {
            const group = cp.groups.find(g => g.betreuer.some(x => x.id === betreuerId))
            if (group) {
                groupId = group.groupId
                groupCheckpointId = cp.id
            }
        }
    }

    return { busNumber, busCheckpointId, groupId, groupCheckpointId }
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
    fetchRemovedCheckpointsForDay,
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
