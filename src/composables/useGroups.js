import { supabase } from '@/supabase'
import { useConfigStore } from '@/stores/config'

/**
 * Composable for working with group data from Supabase
 * Provides functions to fetch groups, group details, and summaries
 */

/**
 * Fetches groups data for a specific date
 * Combines data from groups_today and user_group_day
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of group objects
 */
export async function fetchGroupsData(date) {
    try {
        // 1. Load children counters from groups_today
        const { data: groupsData, error: groupsError } = await supabase
            .from('groups_today')
            .select('group_id, children_today, children_now')
            .order('group_id', { ascending: true })

        if (groupsError) throw groupsError

        // 2. Load caregivers (Betreuer) from user_group_day with names
        const { data: betreuerData, error: betreuerError } = await supabase
            .from('user_group_day')
            .select(`
        group_id,
        user_id,
        users!inner(
          id,
          display_name
        )
      `)
            .eq('day', date)
            .eq('isPresentToday', 1)  // Only those who confirmed presence
            .order('group_id', { ascending: true })

        if (betreuerError) throw betreuerError

        // 3. Group caregivers by group_id
        const betreuerByGroup = {}
        if (betreuerData) {
            betreuerData.forEach(item => {
                const groupId = item.group_id
                if (!betreuerByGroup[groupId]) {
                    betreuerByGroup[groupId] = []
                }
                betreuerByGroup[groupId].push(item.users.display_name)
            })
        }

        // 4. Combine data
        const result = []

        // Get total number of groups from config
        const configStore = useConfigStore()
        const totalGroups = configStore.totalGroups || 15

        // Create entries for all groups
        for (let groupId = 1; groupId <= totalGroups; groupId++) {
            // Find counters for this group
            const groupData = groupsData?.find(g => g.group_id === groupId)

            result.push({
                id: groupId,
                morning: groupData?.children_today || 0,
                current: groupData?.children_now || 0,
                betreuer: betreuerByGroup[groupId] || [],
                timestamp: null,  // Not used yet
                hasData: !!groupData  // Indicator if data exists for this group
            })
        }

        return result

    } catch (error) {
        console.error('Fehler beim Laden der Gruppendaten:', error)
        throw error
    }
}

/**
 * Fetches detailed information about a specific group
 * Including list of children currently in this group
 *
 * @param {number} groupId - Group number
 * @returns {Promise<Object>} Group details with children list
 */
export async function fetchGroupDetails(groupId) {
    try {
        // 1. Load group counters
        const { data: groupData, error: groupError } = await supabase
            .from('groups_today')
            .select('*')
            .eq('group_id', groupId)
            .maybeSingle()

        if (groupError) throw groupError

        // 2. Load list of children in the group
        const { data: childrenData, error: childrenError } = await supabase
            .from('children_today')
            .select(`
        child_id,
        presence_now,
        presence_today,
        bus_now,
        children!inner(
          id,
          name,
          age,
          schwimmer
        )
      `)
            .eq('group_id', groupId)
            .gt('presence_today', 0)  // Only those who were present today
            .order('children(name)', { ascending: true })

        if (childrenError) throw childrenError

        // 3. Load group caregivers
        const today = new Date().toISOString().split('T')[0]
        const { data: betreuerData, error: betreuerError } = await supabase
            .from('user_group_day')
            .select(`
        user_id,
        bus_id,
        users!inner(
          id,
          display_name,
          email
        )
      `)
            .eq('day', today)
            .eq('group_id', groupId)
            .eq('isPresentToday', 1)

        if (betreuerError) throw betreuerError

        // Format children list
        const children = childrenData?.map(child => ({
            id: child.child_id,
            name: child.children.name,
            age: child.children.age,
            schwimmer: child.children.schwimmer,
            presenceNow: child.presence_now,
            presenceToday: child.presence_today,
            busNow: child.bus_now
        })) || []

        // Format caregivers list
        const betreuer = betreuerData?.map(b => ({
            id: b.user_id,
            name: b.users.display_name,
            email: b.users.email,
            busId: b.bus_id
        })) || []

        return {
            groupId,
            morning: groupData?.children_today || 0,
            current: groupData?.children_now || 0,
            children,
            betreuer,
            hasData: !!groupData
        }

    } catch (error) {
        console.error(`Fehler beim Laden der Gruppe ${groupId}:`, error)
        throw error
    }
}

/**
 * Gets summary statistics for all groups on a given date
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Summary with totals and statistics
 */
export async function getGroupSummary(date) {
    try {
        const groupsData = await fetchGroupsData(date)

        const totalMorning = groupsData.reduce((sum, g) => sum + (g.morning || 0), 0)
        const totalCurrent = groupsData.reduce((sum, g) => sum + (g.current || 0), 0)
        const totalMissing = groupsData.reduce((sum, g) => {
            const diff = (g.morning || 0) - (g.current || 0)
            return sum + (diff > 0 ? diff : 0)
        }, 0)

        const groupsWithData = groupsData.filter(g => g.hasData).length
        const groupsWithMissing = groupsData.filter(g => g.morning > g.current).length

        return {
            totalMorning,
            totalCurrent,
            totalMissing,
            groupsWithData,
            groupsWithMissing,
            totalGroups: groupsData.length
        }

    } catch (error) {
        console.error('Fehler beim Laden der Gruppenstatistik:', error)
        throw error
    }
}

/**
 * Setup realtime subscription for groups_today table
 * Calls callback when data changes
 *
 * @param {Function} callback - Function to call on data change
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToGroupsChanges(callback) {
    const subscription = supabase
        .channel('groups_today_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'groups_today'
            },
            (payload) => {
                console.log('Groups data changed:', payload)
                callback(payload)
            }
        )
        .subscribe()

    return {
        unsubscribe: () => {
            supabase.removeChannel(subscription)
        }
    }
}

export default {
    fetchGroupsData,
    fetchGroupDetails,
    getGroupSummary,
    subscribeToGroupsChanges
}