// src/composables/useDays.js
import { supabase } from '@/supabase'
import { useSupabaseUser } from './useSupabaseUser'

export function useDays() {
    const { getCurrentUser } = useSupabaseUser()

    /**
     * Retrieves a list of all days, sorted by date.
     */
    const fetchDaysList = async () => {
        const { data, error } = await supabase
            .from('days')
            .select('id, date, name, abfahrt, ankommen, description')
            .order('date', { ascending: true })

        if (error) {
            console.error('Error fetching days list:', error)
            throw new Error(error.message)
        }
        return data
    }

    /**
     * Deletes a day by ID.
     * @param {number} dayId - The ID of the day
     */
    const deleteDay = async (dayId) => {
        const { error } = await supabase
            .from('days')
            .delete()
            .eq('id', dayId)

        if (error) {
            console.error('Error deleting day:', error)
            throw new Error(error.message)
        }
        return true
    }

    /**
     * Saves (creates or updates) the day data.
     * @param {object} dayData - The day data. May contain 'id'.
     */
    const saveDay = async (dayData) => {
        const { id, ...payload } = dayData

        // Authorization check:
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            throw new Error("Authorization error: You must be logged in. The RLS policy requires 'authenticated' status.")
        }

        // Data normalization
        const finalPayload = {
            ...payload,
            abfahrt: payload.abfahrt || null,
            ankommen: payload.ankommen || null,
            description: payload.description && payload.description.trim() !== '' ? payload.description.trim() : null,
        }

        let query
        let successMessage

        if (id) {
            // UPDATE (Editing)
            query = supabase
                .from('days')
                .update(finalPayload)
                .eq('id', id)
                .select()
            successMessage = `Day "${payload.date}" updated.`
        } else {
            // INSERT (Creation)
            query = supabase
                .from('days')
                .insert({ ...finalPayload, created_at: new Date().toISOString() })
                .select()
                .single()
            successMessage = `Day "${payload.date}" successfully created.`
        }

        const { data, error } = await query

        if (error) {
            console.error('Error saving day data:', error)
            if (error.message.includes('violates row-level security policy')) {
                throw new Error(`RLS error: Access denied. Ensure the RLS policy for INSERT/UPDATE on table 'days' is set to 'WITH CHECK (true)' for 'authenticated' users.`)
            }
            throw new Error(`Save error: ${error.message}`)
        }

        // ADDITIONAL CHECK FOR UPDATE:
        if (id && (!data || data.length === 0)) {
            throw new Error(`RLS error: Update not performed. The security policy does not allow you to modify record with ID ${id}.`)
        }

        return { data: Array.isArray(data) ? data[0] : data, message: successMessage }
    }

    /**
     * Prüfen, ob der Tag bereits gestartet wurde
     * Checking if reset_events has an OPEN event (event_type = 1) for the date
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<boolean>}
     */
    async function isDayStarted(date) {
        try {
            const { data, error } = await supabase
                .from('reset_events')
                .select('id, event_type')
                .eq('day', date)
                .eq('event_type', 1)
                .limit(1)

            if (error) {
                console.error('Fehler beim Prüfen, ob der Tag gestartet wurde:', error)
                throw error
            }

            return (data && data.length > 0)

        } catch (error) {
            console.error('Fehler in isDayStarted:', error)
            throw error
        }
    }

    /**
     * Prüfen, ob der Tag bereits geschlossen wurde
     * @param {string} date - ISO Datum im Format YYYY-MM-DD
     * @returns {Promise<boolean>}
     */
    async function isDayClosed(date) {
        try {
            const { data, error } = await supabase
                .from('reset_events')
                .select('id, event_type')
                .eq('day', date)
                .in('event_type', [0, 1])
                .order('id', { ascending: false })
                .limit(1)

            if (error) {
                console.error('Fehler beim Prüfen, ob der Tag geschlossen wurde:', error)
                throw error
            }

            if (data && data.length > 0) {
                return data[0].event_type === 0
            } else {
                return false
            }
        } catch (error) {
            console.error('Fehler in isDayClosed:', error)
            throw error
        }
    }

    /**
     * Neuen Tag starten - erstellt Eintrag in reset_events mit event_type = 1
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Object>}
     */
    async function startNewDay(date) {
        try {
            // Aktuellen Benutzer holen
            const currentUser = await getCurrentUser()

            // Eintrag in reset_events erstellen
            const { data, error } = await supabase
                .from('reset_events')
                .insert([
                    {
                        day: date,
                        user_id: currentUser.id,
                        event_type: 1 // Normal reset - Tag öffnen
                    }
                ])
                .select()
                .single()

            if (error) {
                console.error('Fehler beim Erstellen des Reset-Events:', error)
                throw error
            }

            console.log('✅ Tag erfolgreich gestartet:', data)
            return data

        } catch (error) {
            console.error('Fehler in startNewDay:', error)
            throw error
        }
    }

    /**
     * Soft Reset - setzt nur presence_now zurück (event_type = 2)
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Object>}
     */
    async function softReset(date) {
        try {
            if (!date) {
                date = new Date().toISOString().split('T')[0]
            }
            const currentUser = await getCurrentUser()

            const { data, error } = await supabase
                .from('reset_events')
                .insert([
                    {
                        day: date,
                        user_id: currentUser.id,
                        event_type: 2 // Soft reset
                    }
                ])
                .select()
                .single()

            if (error) {
                console.error('Fehler beim Soft Reset:', error)
                throw error
            }

            console.log('✅ Soft Reset durchgeführt:', data)
            return data

        } catch (error) {
            console.error('Fehler in softReset:', error)
            throw error
        }
    }

    /**
     * Total Reset - löscht alle Tagesdaten komplett (event_type = 0)
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @returns {Promise<Object>}
     */
    async function closeDay(date) {
        try {
            if (!date) {
                date = new Date().toISOString().split('T')[0]
            }
            const currentUser = await getCurrentUser()

            const { data, error } = await supabase
                .from('reset_events')
                .insert([
                    {
                        day: date,
                        user_id: currentUser.id,
                        event_type: 0 // Total reset - Tag geschlossen
                    }
                ])
                .select()
                .single()

            if (error) {
                console.error('Fehler beim Total Reset:', error)
                throw error
            }

            console.log('✅ Total Reset durchgeführt - Tag geschlossen:', data)
            return data

        } catch (error) {
            console.error('Fehler in closeDay:', error)
            throw error
        }
    }

    return {
        fetchDaysList,
        saveDay,
        startNewDay,
        softReset,
        closeDay,
        deleteDay,
        isDayStarted,
        isDayClosed,
        // User utilities
        getCurrentUser // Re-export for convenience
    }
}