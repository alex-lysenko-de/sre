// src/composables/useUser.js
import { ref, computed } from 'vue'
import { supabase } from '@/supabase'

const USER_CACHE_KEY = 'user_info_cache'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

// Shared reactive state
const userInfo = ref({
    id: null,              // users.id (bigint)
    user_id: null,         // users.user_id (uuid from auth)
    email: null,           // users.email
    display_name: null,    // users.display_name
    role: null,            // users.role ('admin' | 'user')
    phone: null,           // users.phone

    // From user_group_day table (today)
    group_id: null,        // group number
    bus_id: null,          // bus number
    bMustWorkToday: false, // true if record exists for today with bMustWorkToday==1
    isPresentToday: false, // true if record exists for today with isPresentToday==1
    description: null      // optional note
})

const loading = ref(false)
const error = ref(null)

// Computed properties
const isAdmin = computed(() => userInfo.value.role === 'admin')
const isCheckInRequired = computed(() =>
    !userInfo.value.isPresentToday
)

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0]
}

/**
 * Load cached user data from localStorage
 */
function loadFromCache() {
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
function saveToCache(data) {
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
function clearUserCache() {
    try {
        localStorage.removeItem(USER_CACHE_KEY)
    } catch (err) {
        console.error('Error clearing cache:', err)
    }
}

/**
 * Fetch user data from Supabase
 */
async function fetchUserFromSupabase() {
    try {
        // Get current auth user
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (!session) throw new Error('No active session')

        const authUserId = session.user.id

        // Fetch user data from users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, user_id, email, display_name, role, phone')
            .eq('user_id', authUserId)
            .single()

        if (userError) throw userError
        if (!userData) throw new Error('User not found in database')

        // Fetch today's schedule from user_group_day
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

        // If no record for today, try to get last known group/bus for pre-filling
        let lastKnownGroup = null
        let lastKnownBus = null

        if (!scheduleData) {
            const { data: lastRecord } = await supabase
                .from('user_group_day')
                .select('group_id, bus_id')
                .eq('user_id', userData.id)
                .order('day', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (lastRecord) {
                lastKnownGroup = lastRecord.group_id
                lastKnownBus = lastRecord.bus_id
                console.log(`📋 Pre-filling from last record: Group ${lastKnownGroup}, Bus ${lastKnownBus}`)
            }
        }

        // Combine data
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
 * Load user data (with caching)
 * @param {boolean} force - Force reload from database, ignore cache
 */
async function loadUser(force = false) {
    if (loading.value) return

    loading.value = true
    error.value = null

    try {
        // Try cache first if not forced
        if (!force) {
            const cached = loadFromCache()
            if (cached) {
                userInfo.value = cached
                console.log('✅ User data loaded from cache')
                return
            }
        }

        // Fetch from database
        const data = await fetchUserFromSupabase()
        userInfo.value = data
        saveToCache(data)
        console.log('✅ User data loaded from Supabase')
    } catch (err) {
        error.value = err
        console.error('❌ Error loading user:', err)
    } finally {
        loading.value = false
    }
}

/**
 * Assign user to a group for a specific date
 * @param {number} groupId - Group number
 * @param {string} date - Date in YYYY-MM-DD format (default: today)
 */
async function assignUserToGroup(groupId, date = getTodayDate()) {
    try {
        if (!userInfo.value.id) {
            throw new Error('User not loaded')
        }

        // Check if record exists
        const { data: existing, error: fetchError } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userInfo.value.id)
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
                    group_id: groupId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            // Create new record
            const { error: insertError } = await supabase
                .from('user_group_day')
                .insert({
                    user_id: userInfo.value.id,
                    day: date,
                    group_id: groupId,
                    bMustWorkToday: 0,
                    isPresentToday: 0,
                    created_at: new Date().toISOString()
                })

            if (insertError) throw insertError
        }

        // Update local state if it's today
        if (date === getTodayDate()) {
            userInfo.value.group_id = groupId
            saveToCache(userInfo.value)
        }

        console.log(`✅ User assigned to group ${groupId} for ${date}`)
    } catch (err) {
        console.error('Error assigning user to group:', err)
        throw err
    }
}

/**
 * Assign user to a bus for a specific date
 * @param {number} busId - Bus number
 * @param {string} date - Date in YYYY-MM-DD format (default: today)
 */
async function assignUserToBus(busId, date = getTodayDate()) {
    try {
        if (!userInfo.value.id) {
            throw new Error('User not loaded')
        }

        // Check if record exists
        const { data: existing, error: fetchError } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userInfo.value.id)
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
                    bus_id: busId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            // Create new record
            const { error: insertError } = await supabase
                .from('user_group_day')
                .insert({
                    user_id: userInfo.value.id,
                    day: date,
                    bus_id: busId,
                    bMustWorkToday: 0,
                    isPresentToday: 0,
                    created_at: new Date().toISOString()
                })

            if (insertError) throw insertError
        }

        // Update local state if it's today
        if (date === getTodayDate()) {
            userInfo.value.bus_id = busId
            saveToCache(userInfo.value)
        }

        console.log(`✅ User assigned to bus ${busId} for ${date}`)
    } catch (err) {
        console.error('Error assigning user to bus:', err)
        throw err
    }
}

/**
 * Update user presence status
 * @param {number} status - 0 (absent) or 1 (present)
 * @param {string} date - Date in YYYY-MM-DD format (default: today)
 */
async function updateUserPresence(status, date = getTodayDate()) {
    try {
        if (!userInfo.value.id) {
            throw new Error('User not loaded')
        }

        const isPresentValue = status === 1 ? 1 : 0

        // Check if record exists
        const { data: existing, error: fetchError } = await supabase
            .from('user_group_day')
            .select('id')
            .eq('user_id', userInfo.value.id)
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
                    isPresentToday: isPresentValue,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            // Create new record
            const { error: insertError } = await supabase
                .from('user_group_day')
                .insert({
                    user_id: userInfo.value.id,
                    day: date,
                    isPresentToday: isPresentValue,
                    bMustWorkToday: 0,
                    created_at: new Date().toISOString()
                })

            if (insertError) throw insertError
        }

        // Update local state if it's today
        if (date === getTodayDate()) {
            userInfo.value.isPresentToday = isPresentValue === 1
            saveToCache(userInfo.value)
        }

        console.log(`✅ User presence updated to ${isPresentValue} for ${date}`)
    } catch (err) {
        console.error('Error updating user presence:', err)
        throw err
    }
}

/**
 * Get user's schedule info for a specific date
 * @param {string} date - Date in YYYY-MM-DD format (default: today)
 * @returns {Object} { group_id, bus_id, bMustWorkToday, isPresentToday, description }
 */
async function getUserDayInfo(date = getTodayDate()) {
    try {
        if (!userInfo.value.id) {
            throw new Error('User not loaded')
        }

        const { data, error } = await supabase
            .from('user_group_day')
            .select('group_id, bus_id, bMustWorkToday, isPresentToday, description')
            .eq('user_id', userInfo.value.id)
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
        console.error('Error getting user day info:', err)
        throw err
    }
}

/**
 * Composable export
 */
export function useUser() {
    return {
        // Reactive state
        userInfo,
        isAdmin,
        isCheckInRequired,
        loading,
        error,

        // Methods
        loadUser,
        fetchUserFromSupabase,
        assignUserToGroup,
        assignUserToBus,
        updateUserPresence,
        getUserDayInfo,
        clearUserCache,
        getTodayDate
    }
}