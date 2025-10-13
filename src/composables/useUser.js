// src/composables/useUser.js
import { ref, computed } from 'vue'
import { supabase } from '@/supabase.js'

// Cache configuration
const USER_CACHE_KEY = 'user_info_cache'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes in milliseconds

// Reactive user state
const userInfo = ref({
    // From users table
    id: null,              // users.id (bigint)
    user_id: null,         // users.user_id (uuid from auth)
    email: null,           // users.email
    display_name: null,    // users.display_name
    role: null,            // users.role ('admin' | 'user')

    // From user_group_day table (for today)
    group_id: null,        // group number
    bus_id: null,          // bus number
    bMustWorkToday: false, // true if record exists for today and bMustWorkToday==1
    isPresentToday: false  // true if record exists for today and isPresentToday==1
})

// Reactive state for loading and errors
const loading = ref(false)
const error = ref(null)

/**
 * Computed property to check if user is admin
 */
const isAdmin = computed(() => userInfo.value.role === 'admin')

/**
 * Gets current date in YYYY-MM-DD format
 */
function getCurrentDate() {
    return new Date().toISOString().split('T')[0]
}

/**
 * Checks if cache is valid
 */
function isCacheValid() {
    try {
        const cached = localStorage.getItem(USER_CACHE_KEY)
        if (!cached) return false

        const { timestamp } = JSON.parse(cached)
        return (Date.now() - timestamp) < CACHE_TTL
    } catch {
        return false
    }
}

/**
 * Saves user data to cache
 */
function saveToCache(data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        }
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cacheData))
    } catch (err) {
        console.error('Error saving to cache:', err)
    }
}

/**
 * Loads user data from cache
 */
function loadFromCache() {
    try {
        const cached = localStorage.getItem(USER_CACHE_KEY)
        if (!cached) return null

        const { data } = JSON.parse(cached)
        return data
    } catch (err) {
        console.error('Error loading from cache:', err)
        return null
    }
}

/**
 * Fetches user data directly from Supabase
 */
async function fetchUserFromSupabase() {
    loading.value = true
    error.value = null

    try {
        // Step 1: Get authenticated user from Supabase Auth
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            throw new Error('No authenticated user found')
        }

        // Step 2: Fetch user data from users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, user_id, email, display_name, role')
            .eq('user_id', authUser.id)
            .single()

        if (userError || !userData) {
            throw new Error('User data not found in database')
        }

        // Step 3: Fetch today's schedule from user_group_day
        const today = getCurrentDate()
        const { data: scheduleData, error: scheduleError } = await supabase
            .from('user_group_day')
            .select('group_id, bus_id, bMustWorkToday, isPresentToday, description')
            .eq('user_id', userData.id)
            .eq('day', today)
            .maybeSingle()

        if (scheduleError) {
            console.warn('Error fetching schedule:', scheduleError)
        }

        // Step 4: Combine all data
        const combinedData = {
            id: userData.id,
            user_id: userData.user_id,
            email: userData.email,
            display_name: userData.display_name,
            role: userData.role,
            group_id: scheduleData?.group_id || null,
            bus_id: scheduleData?.bus_id || null,
            bMustWorkToday: scheduleData?.bMustWorkToday === 1,
            isPresentToday: scheduleData?.isPresentToday === 1
        }

        // Update reactive state
        userInfo.value = combinedData

        // Save to cache
        saveToCache(combinedData)

        return combinedData

    } catch (err) {
        error.value = err
        console.error('Error fetching user data:', err)
        throw err
    } finally {
        loading.value = false
    }
}

/**
 * Loads user data with caching support
 * @param {boolean} force - If true, bypass cache and fetch from database
 */
async function loadUser(force = false) {
    if (!force && isCacheValid()) {
        const cachedData = loadFromCache()
        if (cachedData) {
            userInfo.value = cachedData
            return cachedData
        }
    }

    return await fetchUserFromSupabase()
}

/**
 * Assigns user to a group for a specific date
 * @param {number} groupId - Group number
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 */
async function assignUserToGroup(groupId, date = null) {
    if (!userInfo.value.id) {
        throw new Error('User not loaded')
    }

    const targetDate = date || getCurrentDate()

    try {
        // Check if record exists for this date
        const { data: existing } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userInfo.value.id)
            .eq('day', targetDate)
            .maybeSingle()

        if (existing) {
            // Update existing record
            const { error: updateError } = await supabase
                .from('user_group_day')
                .update({ group_id: groupId })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            // Create new record
            const { error: insertError } = await supabase
                .from('user_group_day')
                .insert({
                    user_id: userInfo.value.id,
                    day: targetDate,
                    group_id: groupId,
                    bus_id: userInfo.value.bus_id,
                    bMustWorkToday: 0,
                    isPresentToday: 0,
                    created_at: new Date().toISOString()
                })

            if (insertError) throw insertError
        }

        // Update local state if date is today
        if (targetDate === getCurrentDate()) {
            userInfo.value.group_id = groupId
            saveToCache(userInfo.value)
        }

        return true
    } catch (err) {
        console.error('Error assigning user to group:', err)
        throw err
    }
}

/**
 * Assigns user to a bus for a specific date
 * @param {number} busId - Bus number
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 */
async function assignUserToBus(busId, date = null) {
    if (!userInfo.value.id) {
        throw new Error('User not loaded')
    }

    const targetDate = date || getCurrentDate()

    try {
        // Check if record exists for this date
        const { data: existing } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userInfo.value.id)
            .eq('day', targetDate)
            .maybeSingle()

        if (existing) {
            // Update existing record
            const { error: updateError } = await supabase
                .from('user_group_day')
                .update({ bus_id: busId })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            // Create new record
            const { error: insertError } = await supabase
                .from('user_group_day')
                .insert({
                    user_id: userInfo.value.id,
                    day: targetDate,
                    group_id: userInfo.value.group_id,
                    bus_id: busId,
                    bMustWorkToday: 0,
                    isPresentToday: 0,
                    created_at: new Date().toISOString()
                })

            if (insertError) throw insertError
        }

        // Update local state if date is today
        if (targetDate === getCurrentDate()) {
            userInfo.value.bus_id = busId
            saveToCache(userInfo.value)
        }

        return true
    } catch (err) {
        console.error('Error assigning user to bus:', err)
        throw err
    }
}

/**
 * Updates user's presence status for a specific date
 * @param {boolean} isPresent - True if user confirms presence
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 */
async function updateUserPresence(isPresent, date = null) {
    if (!userInfo.value.id) {
        throw new Error('User not loaded')
    }

    const targetDate = date || getCurrentDate()
    const presenceValue = isPresent ? 1 : 0

    try {
        // Check if record exists for this date
        const { data: existing } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userInfo.value.id)
            .eq('day', targetDate)
            .maybeSingle()

        if (existing) {
            // Update existing record
            const { error: updateError } = await supabase
                .from('user_group_day')
                .update({ isPresentToday: presenceValue })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            // This shouldn't normally happen - presence should be set after group/bus assignment
            throw new Error('No record found for this date')
        }

        // Update local state if date is today
        if (targetDate === getCurrentDate()) {
            userInfo.value.isPresentToday = isPresent
            saveToCache(userInfo.value)
        }

        return true
    } catch (err) {
        console.error('Error updating user presence:', err)
        throw err
    }
}

/**
 * Gets user's schedule information for a specific date
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 * @returns {Object} Schedule data
 */
async function getUserDayInfo(date = null) {
    if (!userInfo.value.id) {
        throw new Error('User not loaded')
    }

    const targetDate = date || getCurrentDate()

    try {
        const { data, error: fetchError } = await supabase
            .from('user_group_day')
            .select('group_id, bus_id, bMustWorkToday, isPresentToday, description')
            .eq('user_id', userInfo.value.id)
            .eq('day', targetDate)
            .maybeSingle()

        if (fetchError) throw fetchError

        if (!data) {
            return {
                group_id: null,
                bus_id: null,
                bMustWorkToday: false,
                isPresentToday: false,
                description: null
            }
        }

        return {
            group_id: data.group_id,
            bus_id: data.bus_id,
            bMustWorkToday: data.bMustWorkToday === 1,
            isPresentToday: data.isPresentToday === 1,
            description: data.description
        }
    } catch (err) {
        console.error('Error fetching user day info:', err)
        throw err
    }
}

/**
 * Clears user cache (used during logout)
 */
function clearUserCache() {
    try {
        localStorage.removeItem(USER_CACHE_KEY)
        userInfo.value = {
            id: null,
            user_id: null,
            email: null,
            display_name: null,
            role: null,
            group_id: null,
            bus_id: null,
            bMustWorkToday: false,
            isPresentToday: false
        }
    } catch (err) {
        console.error('Error clearing user cache:', err)
    }
}

/**
 * Main composable export
 */
export function useUser() {
    return {
        // Reactive state
        userInfo,
        isAdmin,
        loading,
        error,

        // Methods for loading data
        loadUser,
        fetchUserFromSupabase,

        // Methods for working with user_group_day
        assignUserToGroup,
        assignUserToBus,
        updateUserPresence,
        getUserDayInfo,

        // Utilities
        clearUserCache
    }
}