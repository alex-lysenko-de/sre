// src/composables/useUser.js
// Business logic layer - handles caching, validation, orchestration
import { useSupabaseUser } from './useSupabaseUser'

const USER_CACHE_KEY = 'user_info_cache'
const CACHE_TTL = 60 * 1000 // 1 minute

export function useUser() {
    const supabaseUser = useSupabaseUser()

    /**
     * Get today's date in YYYY-MM-DD format
     */
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0]
    }

    /**
     * Load cached user data from localStorage
     */
    const loadFromCache = () => {
        try {
            const cached = localStorage.getItem(USER_CACHE_KEY)
            if (!cached) return null

            const { timestamp, data } = JSON.parse(cached)
            const now = Date.now()

            if (now - timestamp < CACHE_TTL) {
                return data
            }

            return null
        } catch (err) {
            console.error('Error loading cache:', err)
            return null
        }
    }

    /**
     * Save user data to localStorage cache
     */
    const saveToCache = (data) => {
        try {
            const cacheData = {
                timestamp: Date.now(),
                data
            }
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cacheData))
        } catch (err) {
            console.error('Error saving cache:', err)
        }
    }

    /**
     * Clear user cache from localStorage
     */
    const clearCache = () => {
        try {
            localStorage.removeItem(USER_CACHE_KEY)
        } catch (err) {
            console.error('Error clearing cache:', err)
        }
    }

    /**
     * Fetch complete user data from Supabase
     * Combines user info + today's schedule + fallback data
     */
    const fetchUserFromSupabase = async () => {
        try {
            // Get current session
            const session = await supabaseUser.getSession()
            const authUserId = session.user.id

            // Fetch user data
            const userData = await supabaseUser.fetchUserFromDB(authUserId)

            // Fetch today's schedule
            const today = getTodayDate()
            const scheduleData = await supabaseUser.fetchScheduleForDate(userData.id, today)

            // If no schedule for today, try to get last known values
            let lastKnownGroup = null
            let lastKnownBus = null

            if (!scheduleData) {
                const lastRecord = await supabaseUser.fetchLastKnownSchedule(userData.id)
                if (lastRecord) {
                    lastKnownGroup = lastRecord.group_id
                    lastKnownBus = lastRecord.bus_id
                    console.log(`📋 Pre-filling from last record: Group ${lastKnownGroup}, Bus ${lastKnownBus}`)
                }
            }

            // Combine all data
            const combinedData = {
                ...userData,
                group_id: scheduleData?.group_id || lastKnownGroup,
                bus_id: scheduleData?.bus_id || lastKnownBus,
                bMustWorkToday: scheduleData?.bMustWorkToday === 1 || false,
                isPresentToday: scheduleData?.isPresentToday === 1 || false,
                description: scheduleData?.description || null
            }

            return combinedData
        } catch (err) {
            console.error('Error fetching user from Supabase:', err)
            throw err
        }
    }

    /**
     * Upsert schedule field for a specific date
     * @param {number} userId - User ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Object} updates - Fields to update
     */
    const upsertScheduleField = async (userId, date, updates) => {
        try {
            // Check if record exists
            const existing = await supabaseUser.checkScheduleExists(userId, date)

            if (existing) {
                // Update existing
                await supabaseUser.updateScheduleRecord(existing.id, updates)
            } else {
                // Insert new
                await supabaseUser.insertScheduleRecord(userId, date, updates)
            }
        } catch (err) {
            console.error('Error upserting schedule field:', err)
            throw err
        }
    }

    /**
     * Create realtime subscription for admin users
     * @param {string} userId - Auth user ID
     * @param {Function} onUpdate - Callback for user updates
     */
    const createRealtimeSubscription = async (userId, onUpdate) => {
        try {
            const channelName = `user_status_admin_${userId}`

            const handleUpdate = (payload) => {
                const updated = payload.new
                const previous = payload.old

                if (previous.active === true && updated.active === false) {
                    console.log(`⛔ User ${updated.email} was deactivated`)
                }

                if (onUpdate) {
                    onUpdate(payload)
                }
            }

            console.log('📡 Realtime: Admin is subscribing to user status changes')

            const channel = supabaseUser.subscribeToUsersTable(channelName, handleUpdate)
            return channel
        } catch (err) {
            console.error('Error creating realtime subscription:', err)
            throw err
        }
    }

    /**
     * Remove realtime subscription
     * @param {Object} channel - Supabase channel
     */
    const removeRealtimeSubscription = async (channel) => {
        try {
            await supabaseUser.removeChannel(channel)
        } catch (err) {
            console.error('Error removing realtime subscription:', err)
            throw err
        }
    }

    return {
        // Cache operations
        loadFromCache,
        saveToCache,
        clearCache,

        // User data operations
        fetchUserFromSupabase,
        upsertScheduleField,

        // Realtime operations
        createRealtimeSubscription,
        removeRealtimeSubscription,

        // Utilities
        getTodayDate,

        // Direct Supabase operations (for store)
        getSession: supabaseUser.getSession,
        getAuthUser: supabaseUser.getAuthUser,
        fetchScheduleForDate: supabaseUser.fetchScheduleForDate,
        signOut: supabaseUser.signOut
    }
}