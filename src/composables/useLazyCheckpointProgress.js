// src/composables/useLazyCheckpointProgress.js
// Real counterpart to useLazyCheckpointProgressMock.js (Ticket 131). "Checked
// in" = children with a scans row whose packet belongs to this checkpoint
// (scan_packets.checkpoint_id, type=3/LAZY per checkpoints.type - same code
// as scan_packets.type=3/CHECKIN); "not yet" = the full roster minus that
// set - unlike Bus/Group, Lazy isn't restricted to one bus/group, so the
// full children roster (useChildren.fetchAllChildren()) is the relevant set.
import { supabase } from '@/supabase'
import { useChildren } from './useChildren'

async function fetchCheckpointCheckins(checkpointId) {
    const { data, error } = await supabase
        .from('scans')
        .select(`
            child_id, created_at,
            children!inner(id, name, group_id),
            scan_packets!inner(id, author_id)
        `)
        .eq('scan_packets.checkpoint_id', checkpointId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Fehler beim Laden der Lazy-Checkpoint-Meldungen:', error)
        throw error
    }
    return data || []
}

/**
 * Fortschritt einer Lazy-Checkpoint: wer hat sich gemeldet, wer noch nicht,
 * wann war die letzte Meldung.
 *
 * @param {number} checkpointId
 * @returns {Promise<{checkpointId:number, checkedIn:Array, notYet:Array, lastScanAt:?string}>}
 */
export async function fetchLazyCheckpointProgress(checkpointId) {
    const { fetchAllChildren } = useChildren()
    const [rows, allChildren] = await Promise.all([
        fetchCheckpointCheckins(checkpointId),
        fetchAllChildren()
    ])

    const byChild = new Map()
    for (const row of rows) {
        if (!byChild.has(row.child_id)) {
            byChild.set(row.child_id, {
                id: row.child_id,
                name: row.children.name,
                groupId: row.children.group_id,
                timestamp: row.created_at,
                checkedInBy: row.scan_packets.author_id
            })
        }
    }

    const checkedIn = Array.from(byChild.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    const notYet = allChildren
        .filter(c => !byChild.has(c.id))
        .map(c => ({ id: c.id, name: c.name, groupId: c.group_id }))

    const lastScanAt = checkedIn.length ? checkedIn[checkedIn.length - 1].timestamp : null

    return { checkpointId, checkedIn, notYet, lastScanAt }
}

export default {
    fetchLazyCheckpointProgress
}
