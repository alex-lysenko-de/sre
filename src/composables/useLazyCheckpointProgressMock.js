// src/composables/useLazyCheckpointProgressMock.js
// Mock-Pendant zum zukuenftigen useLazyCheckpointProgress.js
// (tickets/130/IMPLEMENTATION_PLAN.md): liefert zu einer Lazy-Checkpoint
// die Listen "bereits gemeldet" / "noch nicht gemeldet" sowie den
// Zeitpunkt der letzten Meldung. Keine Netzwerkanfrage, kein
// Supabase-Import.
//
// UX-Feedback Runde 1: bei realistischer Groesse (~150 Kinder) ist eine
// flache Liste nicht mehr navigierbar - jedes Kind traegt daher zusaetzlich
// eine groupId, damit die aufrufende View nach Gruppe gruppieren kann.
//
// UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung): der vormals
// eigene, unabhaengige LAZY_CHILD_POOL (12 Kinder, eigene Ids 1-12) ist
// entfernt - Lazy nutzt jetzt denselben kanonischen Kinder-Roster wie
// Bus/Group (useChildEntityMock.js), sonst haette ein Kind in Lazy eine
// andere Id als in seiner Kind-Karte gehabt. Das macht auch
// summarizeCheckpoint()s LAZY-Gesamtzahl konsistent mit GROUP (24 statt
// vorher 12). checkedIn traegt zusaetzlich checkedInBy (Betreuer-Id) fuer
// die Scan-Historie der Kind-Karte (useScanHistoryMock.js).
import { CHILD_ROSTER } from './useChildEntityMock'
import { BETREUER_ROSTER } from './useBetreuerEntityMock'

function timeToday(hours, minutes) {
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return d.toISOString()
}

// Cache pro checkpointId, damit wiederholte Aufrufe fuer dieselbe
// Checkpoint dieselben synthetischen Daten liefern.
const progressCache = new Map()

function buildProgress(checkpointId) {
    // 16 von 24 Kindern sind bereits gemeldet, der Rest noch nicht -
    // dasselbe ~2:1-Verhaeltnis wie zuvor (8 von 12), jetzt auf dem vollen
    // Roster.
    const checkedInCount = 16
    const checkedIn = CHILD_ROSTER.slice(0, checkedInCount).map((child, idx) => ({
        id: child.id,
        name: child.name,
        groupId: child.groupId,
        timestamp: timeToday(12, 40 + idx),
        checkedInBy: BETREUER_ROSTER[child.id % BETREUER_ROSTER.length].id
    }))
    const notYet = CHILD_ROSTER.slice(checkedInCount).map(child => ({
        id: child.id,
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
