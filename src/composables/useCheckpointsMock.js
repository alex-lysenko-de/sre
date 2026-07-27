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

import { reactive } from 'vue'

export const CHECKPOINT_TYPE = { BUS: 1, GROUP: 2, LAZY: 3 }
export const CHECKPOINT_STATUS = { OPEN: 1, FINISHED: 2, CANCELLED: 3 }

// Bewusst hartcodiert statt aus useConfigStore gelesen (siehe "Risiken" im
// Plan) - jede Netzwerkabhaengigkeit soll im Prototyp komplett entfallen.
const MOCK_TOTAL_BUSES = 5
const MOCK_TOTAL_GROUPS = 6
const MOCK_BASELINE_CHILDREN_COUNT = 42

const ADMIN_USER = { id: 1, name: 'Hauptadministrator', isAdmin: true }
const BETREUER_MUELLER = { id: 101, name: 'Müller', isAdmin: false }
const BETREUER_SCHMIDT = { id: 102, name: 'Schmidt', isAdmin: false }
const BETREUER_FISCHER = { id: 103, name: 'Fischer', isAdmin: false }

function todayString() {
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

// Namen fuer die synthetischen Kinder-Roster (Group/Lazy) - klein gehalten,
// reicht fuer die Demonstration der geforderten Zustaende.
const CHILD_NAMES = [
    'Anna', 'Ben', 'Clara', 'David', 'Emma', 'Finn',
    'Greta', 'Hannes', 'Ida', 'Jonas', 'Klara', 'Leo',
    'Mia', 'Noah', 'Olivia', 'Paul', 'Quirin', 'Rosa',
    'Sara', 'Tom', 'Ute', 'Vincent', 'Wanda', 'Xaver'
]

function buildGroupRoster() {
    // Verteilt die Namen gleichmaessig auf MOCK_TOTAL_GROUPS Gruppen.
    const roster = {}
    for (let g = 1; g <= MOCK_TOTAL_GROUPS; g++) {
        roster[g] = []
    }
    CHILD_NAMES.forEach((name, idx) => {
        const groupId = (idx % MOCK_TOTAL_GROUPS) + 1
        roster[groupId].push({ id: idx + 1, name })
    })
    return roster
}

const GROUP_ROSTER = buildGroupRoster()

function buildBusesMock({ allReceived, includeEmptyBus }) {
    const names = [BETREUER_MUELLER.name, BETREUER_SCHMIDT.name, BETREUER_FISCHER.name]
    const buses = []
    for (let busNumber = 1; busNumber <= MOCK_TOTAL_BUSES; busNumber++) {
        // Ein Bus zeigt bewusst den Zustand "keine Kinder zugeordnet"
        // (130_2.txt, "fehlende Kinder"-Zustand), unabhaengig vom Status.
        const isEmptyBus = includeEmptyBus && busNumber === MOCK_TOTAL_BUSES
        const hasData = allReceived ? !isEmptyBus : (busNumber % 2 === 1 && !isEmptyBus)

        const kinderCount = hasData ? 4 + (busNumber % 3) : 0
        const betreuerCount = hasData ? 1 : 0
        const betreuerNames = hasData ? [names[busNumber % names.length]] : []

        const packets = hasData ? [{
            id: makeId(),
            authorName: betreuerNames[0],
            receivedAt: timeToday(9, (busNumber * 5) % 60),
            childrenCount: kinderCount
        }] : []

        buses.push({ busNumber, hasData, kinderCount, betreuerCount, betreuerNames, packets })
    }
    return buses
}

function buildGroupsMock({ allComplete }) {
    const names = [BETREUER_MUELLER.name, BETREUER_SCHMIDT.name, BETREUER_FISCHER.name]
    const groups = []
    for (let groupId = 1; groupId <= MOCK_TOTAL_GROUPS; groupId++) {
        const roster = GROUP_ROSTER[groupId] || []
        const morning = roster.length

        // Gruppe 1: keine Daten ("keine Kinder"-Zustand). Gruppe 2: fehlende
        // Kinder (Differenz > 0). Alle anderen: vollstaendig sauber.
        let hasData = true
        let current = morning
        let missingChildren = []

        if (groupId === 1) {
            hasData = false
            current = 0
        } else if (groupId === 2 && !allComplete) {
            current = Math.max(0, morning - 2)
            missingChildren = roster.slice(current)
        }

        groups.push({
            groupId,
            hasData,
            morning,
            current,
            betreuer: hasData ? [names[groupId % names.length]] : [],
            missingChildren
        })
    }
    return groups
}

const checkpoints = reactive([])

function seed() {
    // 1. Bus FINISHED - heute Morgen, automatisch durch ersten Bus-Packet
    //    erstellt (deckt die erste finish_checkpoint()-Baseline ab).
    const finishedBus = {
        id: makeId(),
        type: CHECKPOINT_TYPE.BUS,
        day: todayString(),
        status: CHECKPOINT_STATUS.FINISHED,
        created_by: BETREUER_MUELLER,
        created_at: timeToday(9, 0),
        finished_at: timeToday(9, 5),
        finished_by: ADMIN_USER,
        cancelled_at: null,
        cancelled_by: null,
        baseline_children_count: MOCK_BASELINE_CHILDREN_COUNT,
        buses: buildBusesMock({ allReceived: true, includeEmptyBus: false })
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
        cancelled_at: null,
        cancelled_by: null,
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
        cancelled_at: null,
        cancelled_by: null,
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
        cancelled_at: null,
        cancelled_by: null,
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
        cancelled_at: null,
        cancelled_by: null,
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
 * berechnet.
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
        cancelled_at: null,
        cancelled_by: null,
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

    const dayAlreadyHasBaseline = checkpoints.some(c => c.day === cp.day && c.baseline_children_count != null)
    if (!dayAlreadyHasBaseline) {
        cp.baseline_children_count = MOCK_BASELINE_CHILDREN_COUNT
    }

    return cp
}

/**
 * Bricht eine offene Checkpoint ab. Bereits empfangene Pakete werden - wie
 * im echten Plan spezifiziert - nicht zurueckgerollt (hier gibt es im Mock
 * ohnehin keine echten Pakete, nur die synthetische Anzeige).
 *
 * @param {number} id
 * @returns {Promise<Object>} Aktualisierte Checkpoint oder { error: 'NOT_OPEN' }
 */
export async function cancelCheckpoint(id) {
    const cp = checkpoints.find(c => c.id === id)
    if (!cp || cp.status !== CHECKPOINT_STATUS.OPEN) {
        return { error: 'NOT_OPEN' }
    }

    cp.status = CHECKPOINT_STATUS.CANCELLED
    cp.cancelled_at = new Date().toISOString()
    cp.cancelled_by = ADMIN_USER

    return cp
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

export default {
    CHECKPOINT_TYPE,
    CHECKPOINT_STATUS,
    fetchCheckpointsForDay,
    createCheckpoint,
    finishCheckpoint,
    cancelCheckpoint,
    fetchCheckpointDetail,
    isOverdue
}
