// src/composables/useSupabaseCheckpoints.js
// DB layer (Ticket 133) - nach dem Vorbild von useSupabaseUser.js: NUR
// Supabase-Operationen, keine Berechnungen. Aufbauend auf tickets/132
// (doc/db/checkpoints.sql - Tabelle checkpoints, RPC create/finish/reopen/
// remove_checkpoint, Spalte scan_packets.checkpoint_id). Erste Verwendung
// von supabase.rpc(...) im Projekt (tickets/131/IMPLEMENTATION_PLAN.md,
// "Composable-слой").
//
// Fehlerkontrakt der vier RPC-Wrapper: KEINE Uebersetzung hier - die rohen
// Postgres-Fehler (error.message = Code, error.details = existingId bei
// ALREADY_OPEN, siehe doc/db/checkpoints.sql Kopfkommentar) werden
// unveraendert durchgereicht. Die Uebersetzung in die Mock-Fehlerform
// ({error:'ALREADY_OPEN', existingId}) passiert ausschliesslich in
// useCheckpoints.js (Business-Logik-Schicht) - Trennung nach der
// dreischichtigen Konvention aus CLAUDE.md.
import { supabase } from '@/supabase'

/**
 * Alle Checkpoint-Zeilen eines Tages, aufsteigend nach id (fuer die
 * client-seitige ROW_NUMBER()-Berechnung von seq in useCheckpoints.js).
 *
 * @param {string} day - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
const fetchCheckpointRowsForDay = async (day) => {
    const { data, error } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('day', day)
        .order('id', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Eine einzelne Checkpoint-Zeile.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
const fetchCheckpointRowById = async (id) => {
    const { data, error } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Batch-Auflösung von users.id -> {id, display_name, role} - fuer
 * created_by/finished_by (checkpoints) und author_id (scan_packets), ohne
 * auf FK-Constraint-Namen im PostgREST-Embed angewiesen zu sein (checkpoints
 * hat zwei FKs auf users, was den automatischen Embed mehrdeutig macht).
 *
 * @param {Array<number>} ids
 * @returns {Promise<Array<{id:number, display_name:string, role:string}>>}
 */
const fetchUsersByIds = async (ids) => {
    const uniqueIds = [...new Set((ids || []).filter(id => id != null))]
    if (!uniqueIds.length) return []

    const { data, error } = await supabase
        .from('users')
        .select('id, display_name, role')
        .in('id', uniqueIds)

    if (error) throw error
    return data || []
}

/**
 * Scan-Pakete, die in eine Checkpoint eingegangen sind (scan_packets.checkpoint_id).
 *
 * @param {number} checkpointId
 * @returns {Promise<Array>}
 */
const fetchScanPacketsForCheckpoint = async (checkpointId) => {
    const { data, error } = await supabase
        .from('scan_packets')
        .select('id, author_id, bus_id, group_id, received_at, children_count')
        .eq('checkpoint_id', checkpointId)
        .order('received_at', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Scans zu einer Menge von Paket-Ids (scans.packet_id).
 *
 * @param {Array<number>} packetIds
 * @returns {Promise<Array>}
 */
const fetchScansForPacketIds = async (packetIds) => {
    if (!packetIds || !packetIds.length) return []

    const { data, error } = await supabase
        .from('scans')
        .select('child_id, user_id, packet_id, created_at')
        .in('packet_id', packetIds)

    if (error) throw error
    return data || []
}

/**
 * RPC create_checkpoint(p_type, p_day) - explizite Admin-Erstellung
 * (doc/db/checkpoints.sql, §3). Wirft bei Konflikt/fehlender Admin-Rolle den
 * rohen Postgres-Fehler (siehe Kopfkommentar dieser Datei).
 *
 * @param {number} type - CHECKPOINT_TYPE.BUS/GROUP/LAZY
 * @param {string} day - YYYY-MM-DD
 */
const rpcCreateCheckpoint = async (type, day) => {
    const { data, error } = await supabase.rpc('create_checkpoint', { p_type: type, p_day: day })
    if (error) throw error
    return data
}

/**
 * RPC finish_checkpoint(p_id, p_set_baseline) - doc/db/checkpoints.sql, §4,
 * erweitert um p_set_baseline in doc/db/checkpoints_baseline_confirm.sql
 * (Ticket 147).
 * @param {number} id
 * @param {boolean} [setBaseline]
 */
const rpcFinishCheckpoint = async (id, setBaseline = true) => {
    const { data, error } = await supabase.rpc('finish_checkpoint', { p_id: id, p_set_baseline: setBaseline })
    if (error) throw error
    return data
}

/**
 * RPC set_checkpoint_baseline(p_id) - doc/db/checkpoints_baseline_confirm.sql
 * (Ticket 147): nachtraegliche, explizite Fixierung des presentRoster auf
 * einer bereits geschlossenen Checkpoint.
 * @param {number} id
 */
const rpcSetCheckpointBaseline = async (id) => {
    const { data, error } = await supabase.rpc('set_checkpoint_baseline', { p_id: id })
    if (error) throw error
    return data
}

/**
 * RPC reopen_checkpoint(p_id) - doc/db/checkpoints.sql, §5.
 * @param {number} id
 */
const rpcReopenCheckpoint = async (id) => {
    const { data, error } = await supabase.rpc('reopen_checkpoint', { p_id: id })
    if (error) throw error
    return data
}

/**
 * RPC remove_checkpoint(p_id) - doc/db/checkpoints.sql, §6.
 * @param {number} id
 */
const rpcRemoveCheckpoint = async (id) => {
    const { data, error } = await supabase.rpc('remove_checkpoint', { p_id: id })
    if (error) throw error
    return data
}

/**
 * Heutige Zuordnung eines Betreuers aus user_group_day (existierende
 * Tabelle) - Grundlage fuer getBetreuerTodayAssignment() in useCheckpoints.js
 * (tickets/133/133.txt, п.5 - direkter Quelle statt Scan ueber alle
 * Checkpoints des Tages, wie es der Mock tat).
 *
 * @param {number} userId
 * @param {string} day - YYYY-MM-DD
 * @returns {Promise<{group_id:?number, bus_id:?number}|null>}
 */
const fetchUserGroupDayAssignment = async (userId, day) => {
    const { data, error } = await supabase
        .from('user_group_day')
        .select('group_id, bus_id')
        .eq('user_id', userId)
        .eq('day', day)
        .maybeSingle()

    if (error) throw error
    return data
}

export function useSupabaseCheckpoints() {
    return {
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
    }
}

export default useSupabaseCheckpoints
