/**
 * Composable für die Arbeit mit Bus-Daten
 * Kombiniert Daten aus children_today und user_group_day
 *
 * @file src/composables/useBusData.js
 */

import { supabase } from '@/supabase'
import { useSupabaseUser } from './useSupabaseUser'

export function useBusData() {
    const { getCurrentUser } = useSupabaseUser()

    /**
     * Bus-Daten für ein bestimmtes Datum abrufen
     *
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Object>} Objekt mit Bus-Daten: { busNumber: { kinder_count, betreuer_count, betreuer_names } }
     */
    async function fetchBusData(date) {
        try {
            // 1. Kinder-Daten aus children_today abrufen
            const { data: childrenData, error: childrenError } = await supabase
                .from('children_today')
                .select('bus_now, child_id')
                .not('bus_now', 'is', null)
                .gt('presence_now', 0)

            if (childrenError) {
                console.error('Fehler beim Laden der Kinder-Daten:', childrenError)
                throw childrenError
            }

            // 2. Betreuer-Daten aus user_group_day abrufen
            const { data: betreuerData, error: betreuerError } = await supabase
                .from('user_group_day')
                .select(`
          bus_id,
          user_id,
          group_id,
          users!inner(
            id,
            display_name
          )
        `)
                .eq('day', date)
                .eq('isPresentToday', 1)
                .not('bus_id', 'is', null)

            if (betreuerError) {
                console.error('Fehler beim Laden der Betreuer-Daten:', betreuerError)
                throw betreuerError
            }

            // 3. Kinder nach Bussen zählen
            const kinderByBus = {}
            if (childrenData) {
                childrenData.forEach(child => {
                    const busId = child.bus_now
                    if (!kinderByBus[busId]) {
                        kinderByBus[busId] = 0
                    }
                    kinderByBus[busId]++
                })
            }

            // 4. Betreuer nach Bussen zählen und Namen sammeln
            const betreuerByBus = {}
            if (betreuerData) {
                betreuerData.forEach(betreuer => {
                    const busId = betreuer.bus_id
                    if (!betreuerByBus[busId]) {
                        betreuerByBus[busId] = {
                            count: 0,
                            names: []
                        }
                    }
                    betreuerByBus[busId].count++

                    // Namen aus display_name verwenden
                    const displayName = betreuer.users?.display_name || 'Unbekannt'
                    betreuerByBus[busId].names.push(displayName)
                })
            }

            // 5. Daten nach Bussen zusammenführen
            const allBusIds = new Set([
                ...Object.keys(kinderByBus),
                ...Object.keys(betreuerByBus)
            ])

            const result = {}
            allBusIds.forEach(busId => {
                result[busId] = {
                    kinder_count: kinderByBus[busId] || 0,
                    betreuer_count: betreuerByBus[busId]?.count || 0,
                    betreuer_names: betreuerByBus[busId]?.names || []
                }
            })

            return result

        } catch (error) {
            console.error('Fehler in fetchBusData:', error)
            throw error
        }
    }

    /**
     * Daten für einen bestimmten Bus abrufen
     *
     * @param {number} busNumber - Bus-Nummer
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Object>} Bus-Daten
     */
    async function fetchSingleBusData(busNumber, date) {
        try {
            const allBusData = await fetchBusData(date)
            return allBusData[busNumber] || {
                kinder_count: 0,
                betreuer_count: 0,
                betreuer_names: []
            }
        } catch (error) {
            console.error('Fehler in fetchSingleBusData:', error)
            throw error
        }
    }

    /**
     * Reset-Historie für ein bestimmtes Datum abrufen
     *
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Array>} Array von Reset-Ereignissen
     */
    async function getResetHistory(date) {
        try {
            const { data, error } = await supabase
                .from('reset_events')
                .select(`
          id,
          created_at,
          day,
          event_type,
          user_id,
          users!inner(
            id,
            display_name,
            email
          )
        `)
                .eq('day', date)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Fehler beim Laden der Reset-Historie:', error)
                throw error
            }

            return data || []
        } catch (error) {
            console.error('Fehler in getResetHistory:', error)
            throw error
        }
    }

    /**
     * Detaillierte Kinder-Liste für einen Bus abrufen
     *
     * @param {number} busNumber - Bus-Nummer
     * @returns {Promise<Array>} Array von Kinder-Objekten
     */
    async function fetchBusChildren(busNumber) {
        try {
            const { data, error } = await supabase
                .from('children_today')
                .select(`
          child_id,
          group_id,
          bus_now,
          presence_now,
          children!inner(
            id,
            name,
            age,
            schwimmer,
            notes
          )
        `)
                .eq('bus_now', busNumber)
                .gt('presence_now', 0)
                .order('children(name)', { ascending: true })

            if (error) {
                console.error('Fehler beim Laden der Kinder-Liste:', error)
                throw error
            }

            // Daten transformieren für einfachere Verwendung
            return (data || []).map(item => ({
                id: item.children.id,
                name: item.children.name,
                age: item.children.age,
                schwimmer: item.children.schwimmer,
                notes: item.children.notes,
                group_id: item.group_id
            }))

        } catch (error) {
            console.error('Fehler in fetchBusChildren:', error)
            throw error
        }
    }

    /**
     * Detaillierte Betreuer-Liste für einen Bus abrufen
     *
     * @param {number} busNumber - Bus-Nummer
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Array>} Array von Betreuer-Objekten
     */
    async function fetchBusBetreuer(busNumber, date) {
        try {
            const { data, error } = await supabase
                .from('user_group_day')
                .select(`
          user_id,
          group_id,
          bus_id,
          users!inner(
            id,
            display_name,
            email,
            phone
          )
        `)
                .eq('day', date)
                .eq('bus_id', busNumber)
                .eq('isPresentToday', 1)
                .order('users(display_name)', { ascending: true })

            if (error) {
                console.error('Fehler beim Laden der Betreuer-Liste:', error)
                throw error
            }

            // Daten transformieren
            return (data || []).map(item => ({
                id: item.users.id,
                name: item.users.display_name,
                email: item.users.email,
                phone: item.users.phone,
                group_id: item.group_id
            }))

        } catch (error) {
            console.error('Fehler in fetchBusBetreuer:', error)
            throw error
        }
    }

    /**
     * Zusammenfassung aller Busse für ein Datum
     * Erweiterte Version mit zusätzlichen Statistiken
     *
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Object>} Erweiterte Bus-Statistiken
     */
    async function fetchBusSummary(date) {
        try {
            const busData = await fetchBusData(date)

            // Gesamtstatistiken berechnen
            const summary = {
                buses: busData,
                total_buses: Object.keys(busData).length,
                total_children: 0,
                total_betreuer: 0,
                buses_with_data: 0
            }

            Object.values(busData).forEach(bus => {
                summary.total_children += bus.kinder_count
                summary.total_betreuer += bus.betreuer_count
                if (bus.kinder_count > 0 || bus.betreuer_count > 0) {
                    summary.buses_with_data++
                }
            })

            return summary

        } catch (error) {
            console.error('Fehler in fetchBusSummary:', error)
            throw error
        }
    }

    return {
        // Haupt-Funktionen
        fetchBusData,
        fetchSingleBusData,
        fetchBusSummary,

        // Detail-Funktionen
        fetchBusChildren,
        fetchBusBetreuer,

        // Reset-Funktionen
        getResetHistory,

        // User utilities
        getCurrentUser // Re-export for convenience
    }
}