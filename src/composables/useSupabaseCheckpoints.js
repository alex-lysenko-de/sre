// src/composables/useSupabaseCheckpoints.js
// Database layer - ONLY Supabase operations (same role as useSupabaseUser.js).
// Backs the real "Checkpoint" feature (Ticket 131) - reads go through the
// normal authenticated client (RLS: SELECT for authenticated, see
// doc/db/checkpoints.sql); writes go through supabase.rpc(...) calling the
// SECURITY DEFINER functions in doc/db/checkpoints_functions.sql (the first
// use of Postgres RPC anywhere in this project).
//
// created_by/finished_by are embedded as {id, display_name, role} via the
// FK relationship name Postgres auto-generates for an unnamed column FK
// (checkpoints_created_by_fkey / checkpoints_finished_by_fkey,
// doc/db/checkpoints.sql) - useCheckpoints.js (business layer) reshapes
// these into the {id, name, isAdmin} form the UI (CheckpointOriginBadge)
// already expects from useCheckpointsMock.js.
import { supabase } from '@/supabase'

const CHECKPOINT_SELECT = `
  id, type, day, status, created_at, finished_at, baseline_children_count,
  created_by_user:users!checkpoints_created_by_fkey(id, display_name, role),
  finished_by_user:users!checkpoints_finished_by_fkey(id, display_name, role)
`

/**
 * @param {string} day - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchCheckpointsForDay(day) {
    const { data, error } = await supabase
        .from('checkpoints')
        .select(CHECKPOINT_SELECT)
        .eq('day', day)
        .order('id', { ascending: true })

    if (error) {
        console.error('Fehler beim Laden der Checkpoints:', error)
        throw error
    }
    return data || []
}

/**
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function fetchCheckpointDetail(id) {
    const { data, error } = await supabase
        .from('checkpoints')
        .select(CHECKPOINT_SELECT)
        .eq('id', id)
        .maybeSingle()

    if (error) {
        console.error('Fehler beim Laden der Checkpoint-Details:', error)
        throw error
    }
    return data
}

/**
 * @param {number} type - CHECKPOINT_TYPE.BUS/GROUP/LAZY
 * @param {string} day - YYYY-MM-DD
 */
export async function rpcCreateCheckpoint(type, day) {
    const { data, error } = await supabase.rpc('create_checkpoint', { p_type: type, p_day: day })
    if (error) throw error
    return data
}

export async function rpcFinishCheckpoint(id) {
    const { data, error } = await supabase.rpc('finish_checkpoint', { p_id: id })
    if (error) throw error
    return data
}

export async function rpcReopenCheckpoint(id) {
    const { data, error } = await supabase.rpc('reopen_checkpoint', { p_id: id })
    if (error) throw error
    return data
}

export async function rpcRemoveCheckpoint(id) {
    const { error } = await supabase.rpc('remove_checkpoint', { p_id: id })
    if (error) throw error
}

/**
 * Realtime-Abo auf die Checkpoints eines Tages - gleiches Muster wie
 * AdminBusView.vue/useGroups.js (postgres_changes, gefiltert nach day).
 *
 * @param {string} day
 * @param {Function} callback
 * @returns {Object} Supabase channel
 */
export function subscribeToCheckpointsChanges(day, callback) {
    return supabase
        .channel('checkpoints_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'checkpoints', filter: `day=eq.${day}` },
            callback
        )
        .subscribe()
}

export async function removeChannel(channel) {
    await supabase.removeChannel(channel)
}

export default {
    fetchCheckpointsForDay,
    fetchCheckpointDetail,
    rpcCreateCheckpoint,
    rpcFinishCheckpoint,
    rpcReopenCheckpoint,
    rpcRemoveCheckpoint,
    subscribeToCheckpointsChanges,
    removeChannel
}
