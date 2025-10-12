// src/composables/useDays.js
import { supabase } from '@/supabase'; // Import Supabase client

export function useDays() {

    /**
     * Retrieves a list of all days, sorted by date.
     */
    const fetchDaysList = async () => {
        const { data, error } = await supabase
            .from('days')
            .select('id, date, name, abfahrt, ankommen, description')
            .order('date', { ascending : true });

        if (error) {
            console.error('Error fetching days list:', error); // Comment translated
            throw new Error(error.message);
        }
        return data;
    };


    /**
     * Deletes a day by ID.
     * @param {number} dayId - The ID of the day
     */
    const deleteDay = async (dayId) => {
        const { error } = await supabase
            .from('days')
            .delete()
            .eq('id', dayId);

        if (error) {
            console.error('Error deleting day:', error); // Comment translated
            throw new Error(error.message);
        }
        return true;
    };

    /**
     * Saves (creates or updates) the day data.
     * @param {object} dayData - The day data. May contain 'id'.
     */
    const saveDay = async (dayData) => {
        const { id, ...payload } = dayData;

        // Authorization check:
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("Authorization error: You must be logged in. The RLS policy requires 'authenticated' status."); // Message translated
        }

        // Data normalization
        const finalPayload = {
            ...payload,
            abfahrt: payload.abfahrt || null,
            ankommen: payload.ankommen || null,
            description: payload.description && payload.description.trim() !== '' ? payload.description.trim() : null,
        };

        let query;
        let successMessage;

        if (id) {
            // UPDATE (Editing)
            query = supabase
                .from('days')
                .update(finalPayload)
                .eq('id', id)
                .select(); // <--- REMOVED .single()
                           // to avoid PGRST116 if RLS blocks the update
            successMessage = `Day "${payload.date}" updated.`; // Message translated
        } else {
            // INSERT (Creation)
            query = supabase
                .from('days')
                .insert({ ...finalPayload, created_at : new Date().toISOString() })
                .select()
                .single(); // <--- .single() remains for INSERT, as we expect one inserted row
            successMessage = `Day "${payload.date}" successfully created.`; // Message translated
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error saving day data:', error); // Comment translated
            if (error.message.includes('violates row-level security policy')) {
                throw new Error(`RLS error: Access denied. Ensure the RLS policy for INSERT/UPDATE on table 'days' is set to 'WITH CHECK (true)' for 'authenticated' users.`); // Message translated
            }
            throw new Error(`Save error: ${error.message}`); // Message translated
        }

        // ADDITIONAL CHECK FOR UPDATE:
        // If it was an UPDATE, and there is no data (data.length === 0), then RLS blocked it.
        if (id && (!data || data.length === 0)) {
            throw new Error(`RLS error: Update not performed. The security policy does not allow you to modify record with ID ${id}.`); // Message translated
        }

        // Return the first element (for INSERT it is always data[0], for UPDATE - data[0])
        return { data: Array.isArray(data) ? data[0] : data, message : successMessage };
    };


    return {
        fetchDaysList,
        saveDay,
        deleteDay,
    };
}