// src/composables/useSupabaseUser.js
// Database layer - ONLY Supabase operations
import { supabase } from '@/supabase'

export function useSupabaseUser() {
    /**
     * Get today's date in YYYY-MM-DD format
     */
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0]
    }

    /**
     * Fetch complete user data (user info + today's schedule)
     */
    const fetchUserData = async () => {
        try {
            // Get current session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError) throw sessionError
            if (!session) throw new Error('No active session')

            const authUserId = session.user.id

            // Fetch user from users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, user_id, email, display_name, role, phone')
                .eq('user_id', authUserId)
                .single()

            if (userError) throw userError
            if (!userData) throw new Error('User not found in database')

            // Fetch today's schedule
            const today = getTodayDate()
            const { data: scheduleData, error: scheduleError } = await supabase
                .from('user_group_day')
                .select('group_id, bus_id, bMustWorkToday, isPresentToday, description')
                .eq('user_id', userData.id)
                .eq('day', today)
                .maybeSingle()

            if (scheduleError && scheduleError.code !== 'PGRST116') {
                console.error('Error fetching schedule:', scheduleError)
            }

            // Fallback: get last known schedule if no record for today
            let lastKnownSchedule = null

            if (!scheduleData) {
                const { data: lastRecord } = await supabase
                    .from('user_group_day')
                    .select('group_id, bus_id')
                    .eq('user_id', userData.id)
                    .order('day', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (lastRecord) {
                    lastKnownSchedule = lastRecord
                    console.log(`📋 Pre-filling from last record: Group ${lastRecord.group_id}, Bus ${lastRecord.bus_id}`)
                }
            }

            // Combine data
            return {
                ...userData,
                group_id: scheduleData?.group_id || lastKnownSchedule?.group_id || null,
                bus_id: scheduleData?.bus_id || lastKnownSchedule?.bus_id || null,
                bMustWorkToday: scheduleData?.bMustWorkToday === 1 || false,
                isPresentToday: scheduleData?.isPresentToday === 1 || false,
                description: scheduleData?.description || null
            }
        } catch (err) {
            console.error('Supabase fetch user error:', err)
            throw err
        }
    }

    /**
     * Update user schedule fields
     * @param {number} userId - User ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Object} fields - Fields to update { group_id?, bus_id?, isPresentToday? }
     */
    const updateUserSchedule = async (userId, date, fields) => {
        try {
            // Check if record exists
            const { data: existing, error: fetchError } = await supabase
                .from('user_group_day')
                .select('id')
                .eq('user_id', userId)
                .eq('day', date)
                .maybeSingle()

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError
            }

            if (existing) {
                // Update existing record
                const { error: updateError } = await supabase
                    .from('user_group_day')
                    .update({
                        ...fields,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)

                if (updateError) throw updateError
            } else {
                // Create new record
                const { error: insertError } = await supabase
                    .from('user_group_day')
                    .insert({
                        user_id: userId,
                        day: date,
                        ...fields,
                        bMustWorkToday: fields.bMustWorkToday || 0,
                        isPresentToday: fields.isPresentToday || 0,
                        created_at: new Date().toISOString()
                    })

                if (insertError) throw insertError
            }

            return true
        } catch (err) {
            console.error('Update schedule error:', err)
            throw err
        }
    }

    /**
     * Update user's group assignment for today
     * @param {string} userId - Auth user UUID
     * @param {number} groupId - Group ID
     */
    async function updateUserGroup(userId, groupId) {
        const today = new Date().toISOString().split('T')[0]

        // Get user's database ID
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!user) throw new Error('Benutzer nicht gefunden')

        // Update or insert today's schedule
        const { error } = await supabase
            .from('user_day_status')
            .upsert({
                user_id: user.id,
                date: today,
                group_id: groupId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,date'
            })

        if (error) {
            throw new Error(`Fehler beim Aktualisieren der Gruppe: ${error.message}`)
        }
    }

    /**
     * Update user's bus assignment for today
     * @param {string} userId - Auth user UUID
     * @param {number} busId - Bus ID
     */
    async function updateUserBus(userId, busId) {
        const today = new Date().toISOString().split('T')[0]

        // Get user's database ID
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!user) throw new Error('Benutzer nicht gefunden')

        // Update or insert today's schedule
        const { error } = await supabase
            .from('user_day_status')
            .upsert({
                user_id: user.id,
                date: today,
                bus_id: busId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,date'
            })

        if (error) {
            throw new Error(`Fehler beim Aktualisieren des Busses: ${error.message}`)
        }
    }

    /**
     * Update user's presence status for today
     * @param {string} userId - Auth user UUID
     * @param {boolean} isPresent - Is user present today
     * @param {number|null} groupId - Optional group ID
     * @param {number|null} busId - Optional bus ID
     */
    async function updateUserPresence(userId, isPresent, groupId = null, busId = null) {
        const today = new Date().toISOString().split('T')[0]

        // Get user's database ID
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('user_id', userId)
            .single()

        if (!user) throw new Error('Benutzer nicht gefunden')

        // Prepare update data
        const updateData = {
            user_id: user.id,
            date: today,
            isPresentToday: isPresent,
            updated_at: new Date().toISOString()
        }

        if (groupId !== null) updateData.group_id = groupId
        if (busId !== null) updateData.bus_id = busId

        // Update or insert today's schedule
        const { error } = await supabase
            .from('user_day_status')
            .upsert(updateData, {
                onConflict: 'user_id,date'
            })

        if (error) {
            throw new Error(`Fehler beim Aktualisieren der Anwesenheit: ${error.message}`)
        }
    }

    /**
     * Update user profile information
     * @param {string} userId - Auth user UUID
     * @param {Object} profileData - Profile data to update
     */
    async function updateUserProfile(userId, profileData) {
        const { error } = await supabase
            .from('users')
            .update({
                ...profileData,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)

        if (error) {
            throw new Error(`Fehler beim Aktualisieren des Profils: ${error.message}`)
        }
    }

    /**
     * Get user schedule for a specific date
     * @param {number} userId - User ID
     * @param {string} date - Date in YYYY-MM-DD format
     */
    const getUserSchedule = async (userId, date) => {
        try {
            const { data, error } = await supabase
                .from('user_group_day')
                .select('group_id, bus_id, bMustWorkToday, isPresentToday, description')
                .eq('user_id', userId)
                .eq('day', date)
                .maybeSingle()

            if (error && error.code !== 'PGRST116') {
                throw error
            }

            return data || {
                group_id: null,
                bus_id: null,
                bMustWorkToday: false,
                isPresentToday: false,
                description: null
            }
        } catch (err) {
            console.error('Get schedule error:', err)
            throw err
        }
    }

    /**
     * Subscribe to user changes (admin only)
     * @param {Function} callback - Callback function for changes
     */
    const subscribeToUserChanges = async (callback) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const channel = supabase
                .channel(`user_changes_${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'users'
                    },
                    (payload) => {
                        console.log('📡 User change detected:', payload)
                        callback(payload)
                    }
                )
                .subscribe((status) => {
                    console.log('Realtime status:', status)
                })

            return channel
        } catch (err) {
            console.error('Subscribe error:', err)
            throw err
        }
    }

    /**
     * Unsubscribe from changes
     * @param {Object} subscription - Channel subscription
     */
    const unsubscribeFromChanges = async (subscription) => {
        try {
            await supabase.removeChannel(subscription)
        } catch (err) {
            console.error('Unsubscribe error:', err)
            throw err
        }
    }

    /**
     * Sign out user
     */
    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
        } catch (err) {
            console.error('Sign out error:', err)
            throw err
        }
    }

    return {
        fetchUserData,
        updateUserSchedule,
        updateUserGroup,
        updateUserBus,
        updateUserPresence,
        updateUserProfile,
        getUserSchedule,
        subscribeToUserChanges,
        unsubscribeFromChanges,
        signOut,
        getTodayDate
    }
}