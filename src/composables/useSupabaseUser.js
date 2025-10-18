// src/composables/useSupabaseUser.js
// Database layer - ONLY Supabase operations
import { supabase } from '@/supabase'

export function useSupabaseUser() {
    /**
     * Get current authenticated session
     */
    const getSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!session) throw new Error('No active session')
        return session
    }

    /**
     * Get authenticated user
     */
    const getAuthUser = async () => {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        return user
    }

    /**
     * Fetch user data from users table
     * @param {string} authUserId - UUID from auth.users
     */
    const fetchUserFromDB = async (authUserId) => {
        const { data, error } = await supabase
            .from('users')
            .select('id, user_id, email, display_name, role, phone')
            .eq('user_id', authUserId)
            .single()

        if (error) throw error
        if (!data) throw new Error('User not found in database')
        return data
    }

    /**
     * Fetch user schedule for specific date
     * @param {number} userId - User ID from users table
     * @param {string} date - Date in YYYY-MM-DD format
     */
    const fetchScheduleForDate = async (userId, date) => {
        const { data, error } = await supabase
            .from('user_group_day')
            .select('group_id, bus_id, bMustWorkToday, isPresentToday, description')
            .eq('user_id', userId)
            .eq('day', date)
            .maybeSingle()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        return data
    }

    /**
     * Fetch last known schedule (most recent record)
     * @param {number} userId - User ID from users table
     */
    const fetchLastKnownSchedule = async (userId) => {
        const { data, error } = await supabase
            .from('user_group_day')
            .select('group_id, bus_id')
            .eq('user_id', userId)
            .order('day', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching last schedule:', error)
            return null
        }

        return data
    }

    /**
     * Check if schedule record exists for date
     * @param {number} userId - User ID
     * @param {string} date - Date in YYYY-MM-DD format
     */
    const checkScheduleExists = async (userId, date) => {
        const { data, error } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userId)
            .eq('day', date)
            .maybeSingle()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        return data
    }

    /**
     * Update existing schedule record
     * @param {number} recordId - Record ID in user_group_day
     * @param {Object} updates - Fields to update
     */
    const updateScheduleRecord = async (recordId, updates) => {
        const { error } = await supabase
            .from('user_group_day')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', recordId)

        if (error) throw error
    }

    /**
     * Insert new schedule record
     * @param {number} userId - User ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Object} data - Schedule data
     */
    const insertScheduleRecord = async (userId, date, data) => {
        const { error } = await supabase
            .from('user_group_day')
            .insert({
                user_id: userId,
                day: date,
                bMustWorkToday: 0,
                isPresentToday: 0,
                ...data,
                created_at: new Date().toISOString()
            })

        if (error) throw error
    }

    /**
     * Subscribe to postgres changes on users table
     * @param {string} channelName - Unique channel name
     * @param {Function} callback - Callback for UPDATE events
     */
    const subscribeToUsersTable = (channelName, callback) => {
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'users' },
                callback
            )
            .subscribe((status) => {
                console.log('Realtime channel status:', status)
            })

        return channel
    }

    /**
     * Remove subscription channel
     * @param {Object} channel - Supabase channel
     */
    const removeChannel = async (channel) => {
        await supabase.removeChannel(channel)
    }

    /**
     * Sign out user
     */
    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    return {
        getSession,
        getAuthUser,
        fetchUserFromDB,
        fetchScheduleForDate,
        fetchLastKnownSchedule,
        checkScheduleExists,
        updateScheduleRecord,
        insertScheduleRecord,
        subscribeToUsersTable,
        removeChannel,
        signOut
    }
}