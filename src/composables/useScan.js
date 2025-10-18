// src/composables/useScan.js
import { supabase } from '@/supabase'

export function useScan() {
    /**
     * Heutiges Datum im Format YYYY-MM-DD
     * @returns {string}
     */
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0]
    }

    /**
     * Prüft, ob ein Kind heute anwesend ist
     * @param {number} childId - ID des Kindes
     * @param {string} date - Datum im Format YYYY-MM-DD (optional, default: heute)
     * @returns {Promise<boolean>}
     */
    const isChildPresentToday = async (childId, date = null) => {
        try {
            const targetDate = date || getTodayDate()

            const { data, error } = await supabase
                .from('scans')
                .select('id')
                .eq('child_id', childId)
                .eq('date', targetDate)
                .limit(1)
                .maybeSingle()

            if (error && error.code !== 'PGRST116') {
                throw error
            }

            return !!data
        } catch (err) {
            console.error('Fehler beim Prüfen der Anwesenheit:', err)
            throw err
        }
    }

    /**
     * Ermittelt die Bus-ID des Kindes für heute (letzte Scan-Eintrag mit bus_id)
     * @param {number} childId - ID des Kindes
     * @param {string} date - Datum im Format YYYY-MM-DD (optional, default: heute)
     * @returns {Promise<number|null>}
     */
    const getChildBusForToday = async (childId, date = null) => {
        try {
            const targetDate = date || getTodayDate()

            const { data, error } = await supabase
                .from('scans')
                .select('bus_id')
                .eq('child_id', childId)
                .eq('date', targetDate)
                .not('bus_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error && error.code !== 'PGRST116') {
                throw error
            }

            return data?.bus_id || null
        } catch (err) {
            console.error('Fehler beim Abrufen der Bus-ID:', err)
            throw err
        }
    }

    /**
     * Holt alle Scans für ein Kind an einem bestimmten Tag
     * @param {number} childId - ID des Kindes
     * @param {string} date - Datum im Format YYYY-MM-DD (optional, default: heute)
     * @returns {Promise<Array>}
     */
    const getChildScansForDate = async (childId, date = null) => {
        try {
            const targetDate = date || getTodayDate()

            const { data, error } = await supabase
                .from('scans')
                .select('id, created_at, bus_id, type, user_id, band_id')
                .eq('child_id', childId)
                .eq('date', targetDate)
                .order('created_at', { ascending: false })

            if (error) throw error

            return data || []
        } catch (err) {
            console.error('Fehler beim Abrufen der Scans:', err)
            throw err
        }
    }

    /**
     * Holt alle Anwesenheitstage für ein Kind (alle Tage mit mindestens einem Scan)
     * @param {number} childId - ID des Kindes
     * @returns {Promise<Array>} Array mit Datum-Strings
     */
    const getChildAttendanceDays = async (childId) => {
        try {
            const { data, error } = await supabase
                .from('scans')
                .select('date')
                .eq('child_id', childId)
                .order('date', { ascending: false })

            if (error) throw error

            // Entferne Duplikate
            const uniqueDates = [...new Set(data.map(scan => scan.date))]
            return uniqueDates
        } catch (err) {
            console.error('Fehler beim Abrufen der Anwesenheitstage:', err)
            throw err
        }
    }

    /**
     * Holt alle anwesenden Kinder für ein bestimmtes Datum
     * @param {string} date - Datum im Format YYYY-MM-DD (optional, default: heute)
     * @returns {Promise<Array>} Array mit { child_id, bus_id }
     */
    const getPresentChildrenForDate = async (date = null) => {
        try {
            const targetDate = date || getTodayDate()

            const { data, error } = await supabase
                .from('scans')
                .select('child_id, bus_id')
                .eq('date', targetDate)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Gruppiere nach child_id und nimm die neueste bus_id
            const childrenMap = new Map()

            data.forEach(scan => {
                if (!childrenMap.has(scan.child_id)) {
                    childrenMap.set(scan.child_id, {
                        child_id: scan.child_id,
                        bus_id: scan.bus_id
                    })
                } else if (scan.bus_id && !childrenMap.get(scan.child_id).bus_id) {
                    // Update bus_id wenn es noch nicht gesetzt ist
                    childrenMap.get(scan.child_id).bus_id = scan.bus_id
                }
            })

            return Array.from(childrenMap.values())
        } catch (err) {
            console.error('Fehler beim Abrufen der anwesenden Kinder:', err)
            throw err
        }
    }

    /**
     * Holt detaillierte Informationen über anwesende Kinder (mit Namen, Gruppe, etc.)
     * @param {string} date - Datum im Format YYYY-MM-DD (optional, default: heute)
     * @returns {Promise<Array>}
     */
    const getPresentChildrenDetailsForDate = async (date = null) => {
        try {
            const targetDate = date || getTodayDate()

            const { data, error } = await supabase
                .from('scans')
                .select(`
          child_id,
          bus_id,
          children (
            id,
            name,
            age,
            group_id,
            schwimmer
          )
        `)
                .eq('date', targetDate)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Gruppiere nach child_id
            const childrenMap = new Map()

            data.forEach(scan => {
                if (!childrenMap.has(scan.child_id)) {
                    childrenMap.set(scan.child_id, {
                        ...scan.children,
                        bus_id: scan.bus_id
                    })
                } else if (scan.bus_id && !childrenMap.get(scan.child_id).bus_id) {
                    childrenMap.get(scan.child_id).bus_id = scan.bus_id
                }
            })

            return Array.from(childrenMap.values())
        } catch (err) {
            console.error('Fehler beim Abrufen der Kinder-Details:', err)
            throw err
        }
    }

    /**
     * Erstellt einen neuen Scan-Eintrag
     * @param {Object} scanData - { user_id, child_id, band_id, bus_id?, type? }
     * @param {string} date - Datum im Format YYYY-MM-DD (optional, default: heute)
     * @returns {Promise<Object>}
     */
    const createScan = async (scanData, date = null) => {
        try {
            const targetDate = date || getTodayDate()

            const payload = {
                date: targetDate,
                user_id: scanData.user_id,
                child_id: scanData.child_id,
                band_id: scanData.band_id,
                bus_id: scanData.bus_id || null,
                type: scanData.type || 1,
                created_at: new Date().toISOString()
            }

            const { data, error } = await supabase
                .from('scans')
                .insert(payload)
                .select()
                .single()

            if (error) throw error

            console.log(`✅ Scan erstellt für Kind ${scanData.child_id}`)
            return data
        } catch (err) {
            console.error('Fehler beim Erstellen des Scans:', err)
            throw err
        }
    }

    return {
        getTodayDate,
        isChildPresentToday,
        getChildBusForToday,
        getChildScansForDate,
        getChildAttendanceDays,
        getPresentChildrenForDate,
        getPresentChildrenDetailsForDate,
        createScan
    }
}