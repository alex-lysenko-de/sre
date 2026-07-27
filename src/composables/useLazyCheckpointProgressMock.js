// src/composables/useLazyCheckpointProgressMock.js
// Mock-Pendant zum zukuenftigen useLazyCheckpointProgress.js
// (tickets/130/IMPLEMENTATION_PLAN.md): liefert zu einer Lazy-Checkpoint
// die Listen "bereits gemeldet" / "noch nicht gemeldet" sowie den
// Zeitpunkt der letzten Meldung - berechnet aus einem synthetischen Kinder-
// Pool, der (wie im echten Lazy-Typ) keiner Gruppe zugeordnet ist. Keine
// Netzwerkanfrage, kein Supabase-Import.

// Eigener, von useCheckpointsMock.js unabhaengiger Pool - Lazy ist nicht an
// eine Gruppe gebunden ("Kinder ohne Gruppe", siehe Plan).
const LAZY_CHILD_POOL = [
    'Alina', 'Bruno', 'Carla', 'Doro', 'Elias', 'Frida',
    'Gustav', 'Helga', 'Ivo', 'Jule', 'Karl', 'Lotte'
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
    const checkedIn = LAZY_CHILD_POOL.slice(0, checkedInCount).map((name, idx) => ({
        id: idx + 1,
        name,
        timestamp: timeToday(12, 40 + idx)
    }))
    const notYet = LAZY_CHILD_POOL.slice(checkedInCount).map((name, idx) => ({
        id: checkedInCount + idx + 1,
        name
    }))

    const lastScanAt = checkedIn.length ? checkedIn[checkedIn.length - 1].timestamp : null

    return { checkpointId, checkedIn, notYet, lastScanAt }
}

/**
 * Fortschritt einer Lazy-Checkpoint: wer hat sich gemeldet, wer noch nicht,
 * wann war die letzte Meldung.
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
