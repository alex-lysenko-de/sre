// src/composables/useLazyCheckpointProgressMock.js
// Mock-Pendant zum zukuenftigen useLazyCheckpointProgress.js
// (tickets/130/IMPLEMENTATION_PLAN.md): liefert zu einer Lazy-Checkpoint
// die Listen "bereits gemeldet" / "noch nicht gemeldet" sowie den
// Zeitpunkt der letzten Meldung - berechnet aus einem synthetischen Kinder-
// Pool, der (wie im echten Lazy-Typ) keiner Gruppe zugeordnet ist. Keine
// Netzwerkanfrage, kein Supabase-Import.
//
// UX-Feedback Runde 1: bei realistischer Groesse (~150 Kinder) ist eine
// flache Liste nicht mehr navigierbar - jedes Kind traegt daher zusaetzlich
// eine groupId, damit die aufrufende View nach Gruppe gruppieren kann.

// Eigener, von useCheckpointsMock.js unabhaengiger Pool - Lazy ist nicht an
// eine Gruppe gebunden, aber jedes Kind gehoert trotzdem zu irgendeiner
// Gruppe (fuer die Gruppierung in der Liste, siehe oben).
const LAZY_CHILD_POOL = [
    { name: 'Alina Krause', groupId: 1 },
    { name: 'Bruno Vogel', groupId: 2 },
    { name: 'Carla Wolf', groupId: 3 },
    { name: 'Doro Fuchs', groupId: 1 },
    { name: 'Elias Braun', groupId: 2 },
    { name: 'Frida Berger', groupId: 3 },
    { name: 'Gustav Lang', groupId: 1 },
    { name: 'Helga Roth', groupId: 2 },
    { name: 'Ivo Herrmann', groupId: 3 },
    { name: 'Jule Baur', groupId: 1 },
    { name: 'Karl Schuster', groupId: 2 },
    { name: 'Lotte Franke', groupId: 3 }
]

function timeToday(hours, minutes) {
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return d.toISOString()
}

// Cache pro checkpointId, damit wiederholte Aufrufe fuer dieselbe
// Checkpoint dieselben synthetischen Daten liefern.
const progressCache = new Map()

function buildProgress(checkpointId) {
    // Erste 8 Kinder sind bereits gemeldet, der Rest noch nicht - reicht zur
    // Demonstration von "hat gemeldet" vs. "wartet noch".
    const checkedInCount = 8
    const checkedIn = LAZY_CHILD_POOL.slice(0, checkedInCount).map((child, idx) => ({
        id: idx + 1,
        name: child.name,
        groupId: child.groupId,
        timestamp: timeToday(12, 40 + idx)
    }))
    const notYet = LAZY_CHILD_POOL.slice(checkedInCount).map((child, idx) => ({
        id: checkedInCount + idx + 1,
        name: child.name,
        groupId: child.groupId
    }))

    const lastScanAt = checkedIn.length ? checkedIn[checkedIn.length - 1].timestamp : null

    return { checkpointId, checkedIn, notYet, lastScanAt }
}

/**
 * Fortschritt einer Lazy-Checkpoint: wer hat sich gemeldet, wer noch nicht,
 * wann war die letzte Meldung. Jedes Kind traegt eine groupId, damit die
 * aufrufende View bei grossen Listen nach Gruppe gruppieren kann.
 *
 * @param {number} checkpointId
 * @returns {Promise<{checkpointId:number, checkedIn:Array, notYet:Array, lastScanAt:?string}>}
 */
export async function fetchLazyCheckpointProgress(checkpointId) {
    if (!progressCache.has(checkpointId)) {
        progressCache.set(checkpointId, buildProgress(checkpointId))
    }
    return progressCache.get(checkpointId)
}

export default {
    fetchLazyCheckpointProgress
}
