// src/composables/useUser.js
// Business logic layer - handles caching, validation, orchestration
import { useUserStore } from '@/stores/user'
import { useSupabaseUser } from './useSupabaseUser'

const CACHE_KEY = 'user_info_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes (increased from 1)

export function useUser() {
    const userStore = useUserStore()
    const supabaseUser = useSupabaseUser()

    /**
     * Get today's date in YYYY-MM-DD format
     */
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0]
    }

    /**
     * Load user from cache
     */
    const loadFromCache = () => {
        try {
            const cached = localStorage.getItem(CACHE_KEY)
            if (!cached) return null

            const { timestamp, data } = JSON.parse(cached)
            const now = Date.now()

            if (now - timestamp < CACHE_TTL) {
                console.log('✅ User loaded from cache')
                return data
            }

            return null
        } catch (err) {
            console.error('Cache load error:', err)
            return null
        }
    }

    /**
     * Save user to cache
     */
    const saveToCache = (data) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data
            }))
        } catch (err) {
            console.error('Cache save error:', err)
        }
    }

    /**
     * Clear cache
     */
    const clearCache = () => {
        try {
            localStorage.removeItem(CACHE_KEY)
        } catch (err) {
            console.error('Cache clear error:', err)
        }
    }

    /**
     * Load user data with caching
     * @param {boolean} force - Force reload, ignore cache
     */
    const loadUser = async (force = false) => {
        if (userStore.loading) return

        userStore.setLoading(true)
        userStore.setError(null)

        try {
            // Try cache first
            if (!force) {
                const cached = loadFromCache()
                if (cached) {
                    userStore.setUser(cached)
                    return cached
                }
            }

            // Fetch from database
            const userData = await supabaseUser.fetchUserData()

            if (!userData) {
                throw new Error('User not found')
            }

            // Update store and cache
            userStore.setUser(userData)
            saveToCache(userData)

            console.log('✅ User loaded from database')

            // Subscribe to realtime if admin
            if (userData.role === 'admin') {
                await subscribeToRealtime()
            }

            return userData

        } catch (err) {
            console.error('❌ Load user error:', err)
            userStore.setError(err)
            throw err
        } finally {
            userStore.setLoading(false)
        }
    }

    /**
     * Update user schedule field (generic method)
     * @param {string} field - 'group_id' | 'bus_id' | 'isPresentToday'
     * @param {*} value - New value
     * @param {string} date - Target date (default: today)
     */
    const updateScheduleField = async (field, value, date = null) => {
        const targetDate = date || getTodayDate()

        try {
            if (!userStore.userId) {
                throw new Error('User not loaded')
            }

            // Validate field
            const validFields = ['group_id', 'bus_id', 'isPresentToday', 'bMustWorkToday']
            if (!validFields.includes(field)) {
                throw new Error(`Invalid field: ${field}`)
            }

            // Update in database
            await supabaseUser.updateUserSchedule(
                userStore.userId,
                targetDate,
                { [field]: value }
            )

            // Update store if today
            if (targetDate === getTodayDate()) {
                userStore.updateSchedule({ [field]: value })
                saveToCache(userStore.userInfo)
            }

            console.log(`✅ ${field} updated to ${value}`)
        } catch (err) {
            console.error(`Error updating ${field}:`, err)
            throw err
        }
    }

    /**
     * Assign user to group
     */
    const assignToGroup = async (groupId, date = null) => {
        return updateScheduleField('group_id', groupId, date)
    }

    /**
     * Assign user to bus
     */
    const assignToBus = async (busId, date = null) => {
        return updateScheduleField('bus_id', busId, date)
    }

    /**
     * Update presence status
     */
    const updatePresence = async (isPresent, date = null) => {
        const value = isPresent ? 1 : 0
        return updateScheduleField('isPresentToday', value, date)
    }

    /**
     * Subscribe to realtime updates (admin only)
     */
    const subscribeToRealtime = async () => {
        if (userStore.realtimeSubscription) {
            console.log('⚠️ Already subscribed to realtime')
            return
        }

        if (!userStore.isAdmin) {
            console.log('⚠️ Not admin, skipping realtime subscription')
            return
        }

        try {
            const subscription = await supabaseUser.subscribeToUserChanges((payload) => {
                console.log('📡 Realtime update received:', payload)
                // Handle realtime updates here
            })

            userStore.setRealtimeSubscription(subscription)
            console.log('✅ Subscribed to realtime updates')
        } catch (err) {
            console.error('Realtime subscription error:', err)
        }
    }

    /**
     * Unsubscribe from realtime
     */
    const unsubscribeFromRealtime = async () => {
        if (!userStore.realtimeSubscription) return

        try {
            await supabaseUser.unsubscribeFromChanges(userStore.realtimeSubscription)
            userStore.clearRealtimeSubscription()
            console.log('✅ Unsubscribed from realtime')
        } catch (err) {
            console.error('Unsubscribe error:', err)
        }
    }

    /**
     * Logout user
     */
    const logout = async () => {
        try {
            // Unsubscribe from realtime
            await unsubscribeFromRealtime()

            // Clear cache
            clearCache()

            // Reset store
            userStore.resetUser()

            // Sign out from Supabase
            await supabaseUser.signOut()

            console.log('✅ Logged out successfully')
        } catch (err) {
            console.error('Logout error:', err)
            throw err
        }
    }

    return {
        // State (from store)
        userInfo: () => userStore.userInfo,
        loading: () => userStore.loading,
        error: () => userStore.error,

        // Getters
        isAdmin: () => userStore.isAdmin,
        needsCheckIn: () => userStore.needsCheckIn,

        // Actions
        loadUser,
        assignToGroup,
        assignToBus,
        updatePresence,
        logout,
        clearCache,

        // Utilities
        getTodayDate
    }
}