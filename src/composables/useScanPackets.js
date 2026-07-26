// src/composables/useScanPackets.js
// Admin-Lesezugriff auf gesendete Scan-Pakete (scan_packets, tickets/122).
// Nicht zu verwechseln mit dem gleichnamigen-aehnlichen, aber klientseitigen
// useScanPacket.js (Singular, Ticket 120) - Sammlung/Versand eines Pakets.
// Hier: einfache SELECTs ueber den normalen (nicht service_role) Client,
// erlaubt durch die SELECT-RLS-Policy fuer authenticated (doc/db/scan_packets.sql).
import { supabase } from '@/supabase'

const TYPE_BUS = 1
const TYPE_GROUP = 2

const mapPacket = (row) => ({
    id: row.id,
    authorName: row.users?.display_name ?? 'Unbekannt',
    receivedAt: row.received_at,
    childrenCount: row.children_count,
    cancelled: row.cancelled_at !== null
})

/**
 * Pakete vom Typ BUS für einen Bus an einem bestimmten Tag.
 * @param {number} busNumber
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchPacketsForBus(busNumber, date) {
    const { data, error } = await supabase
        .from('scan_packets')
        .select('id, received_at, children_count, cancelled_at, users!inner(display_name)')
        .eq('type', TYPE_BUS)
        .eq('bus_id', busNumber)
        .eq('date', date)
        .order('received_at', { ascending: false })

    if (error) {
        console.error('Fehler beim Laden der Bus-Pakete:', error)
        throw error
    }

    return (data || []).map(mapPacket)
}

/**
 * Pakete vom Typ GROUP für eine Gruppe an einem bestimmten Tag.
 * @param {number} groupId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchPacketsForGroup(groupId, date) {
    const { data, error } = await supabase
        .from('scan_packets')
        .select('id, received_at, children_count, cancelled_at, users!inner(display_name)')
        .eq('type', TYPE_GROUP)
        .eq('group_id', groupId)
        .eq('date', date)
        .order('received_at', { ascending: false })

    if (error) {
        console.error('Fehler beim Laden der Gruppen-Pakete:', error)
        throw error
    }

    return (data || []).map(mapPacket)
}

export default {
    fetchPacketsForBus,
    fetchPacketsForGroup
}
