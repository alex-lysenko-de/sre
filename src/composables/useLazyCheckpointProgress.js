// src/composables/useLazyCheckpointProgress.js
// Reales Pendant zu useLazyCheckpointProgressMock.js (Ticket 133).
// "Gemeldet" = Kinder mit einem scans-Eintrag, dessen packet_id auf ein
// scan_packets mit dieser checkpoint_id verweist (tickets/133/133.txt, п.6);
// "noch nicht" = voller Kinder-Roster minus dieser Menge (LAZY ist
// lager-weit, nicht auf eine Gruppe/einen Bus beschraenkt - wie im Mock).
// "Letzte Meldung" = MAX(scan_packets.received_at) je checkpoint_id (nicht
// scans.created_at - explizite Vorgabe aus 133.txt, п.6).
import { useSupabaseCheckpoints } from './useSupabaseCheckpoints'
import { useChildren } from './useChildren'

const { fetchScanPacketsForCheckpoint, fetchScansForPacketIds } = useSupabaseCheckpoints()
const { fetchAllChildren } = useChildren()

/**
 * Fortschritt einer Lazy-Checkpoint: wer hat sich gemeldet, wer noch nicht,
 * wann war die letzte Meldung.
 *
 * @param {number} checkpointId
 * @returns {Promise<{checkpointId:number, checkedIn:Array, notYet:Array, lastScanAt:?string}>}
 */
export async function fetchLazyCheckpointProgress(checkpointId) {
    const [packets, roster] = await Promise.all([
        fetchScanPacketsForCheckpoint(checkpointId),
        fetchAllChildren()
    ])

    const packetIds = packets.map(p => p.id)
    const scans = await fetchScansForPacketIds(packetIds)

    // Union ueber alle Pakete (decision.md §5 - LAZY akkumuliert wie BUS,
    // Duplikate sind harmlos). Je Kind wird die fruehestmoegliche Meldung
    // behalten.
    const checkedInByChild = new Map()
    for (const scan of scans) {
        const existing = checkedInByChild.get(scan.child_id)
        if (!existing || new Date(scan.created_at) < new Date(existing.timestamp)) {
            checkedInByChild.set(scan.child_id, { timestamp: scan.created_at, checkedInBy: scan.user_id })
        }
    }

    const rosterById = new Map(roster.map(c => [c.id, c]))
    const checkedIn = []
    for (const [childId, info] of checkedInByChild.entries()) {
        const child = rosterById.get(childId)
        checkedIn.push({
            id: childId,
            name: child?.name ?? 'Unbekannt',
            groupId: child?.group_id ?? null,
            timestamp: info.timestamp,
            checkedInBy: info.checkedInBy
        })
    }
    checkedIn.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    const notYet = roster
        .filter(c => !checkedInByChild.has(c.id))
        .map(c => ({ id: c.id, name: c.name, groupId: c.group_id }))

    const lastScanAt = packets.length
        ? packets.reduce((max, p) => (!max || new Date(p.received_at) > new Date(max)) ? p.received_at : max, null)
        : null

    return { checkpointId, checkedIn, notYet, lastScanAt }
}

export default {
    fetchLazyCheckpointProgress
}
