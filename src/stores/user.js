// src/stores/user.js
import { defineStore } from 'pinia'
import { useUser } from '@/composables/useUser'

export const useUserStore = defineStore('user', {
    state: () => ({
        userInfo: {
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
        },
        loading: false,
        error: null,
        userStatusChannel: null    // Realtime subscription channel
    }),

    getters: {
        isAdmin: (state) => state.userInfo.role === 'admin',
        isCheckInRequired: (state) => !!state.userInfo.id && !state.userInfo.isPresentToday,
        userEmail: (state) => state.userInfo.email,
        userId: (state) => state.userInfo.id
    },

    actions: {
        /**
         * Get today's date in YYYY-MM-DD format
         */
        getTodayDate() {
            const user = useUser()
            return user.getTodayDate()
        },

        /**
         * Load cached user data from localStorage
         */
        loadFromCache() {
            const user = useUser()
            return user.loadFromCache()
        },

        /**
         * Save user data to localStorage cache
         */
        saveToCache(data) {
            const user = useUser()
            user.saveToCache(data)
        },

        /**
         * Clear user cache from localStorage
         */
        clearUserCache() {
            const user = useUser()
            user.clearCache()
            this.$reset() // Reset store state to initial values
        },

        /**
         * Fetch user data from Supabase
         */
        async fetchUserFromSupabase() {
            const user = useUser()
            return await user.fetchUserFromSupabase()
        },

        /**
         * Load user data (with caching)
         * @param {boolean} force - Force reload from database, ignore cache
         */
        async loadUser(force = false) {
            if (this.loading) return

            this.loading = true
            this.error = null

            const user = useUser()

            try {
                // Try cache first if not forced
                if (!force) {
                    const cached = user.loadFromCache()
                    if (cached) {
                        this.userInfo = cached
                        console.log('✅ User data loaded from cache')
                        return
                    }
                }

                // Fetch from database
                const data = await user.fetchUserFromSupabase()
                this.userInfo = data
                user.saveToCache(data)
                console.log('✅ User data loaded from Supabase')

                // If admin, subscribe to realtime updates
                if (this.userInfo.role === 'admin') {
                    await this.subscribeToUserStatus()
                }

            } catch (err) {
                this.error = err
                console.error('❌ Error loading user:', err)
            } finally {
                this.loading = false
            }
        },

        /**
         * Assign user to a group for a specific date
         * @param {number} groupId - Group number
         * @param {string} date - Date in YYYY-MM-DD format (default: today)
         */
        async assignUserToGroup(groupId, date = null) {
            const user = useUser()
            const targetDate = date || user.getTodayDate()

            try {
                if (!this.userInfo.id) {
                    throw new Error('User not loaded')
                }

                await user.upsertScheduleField(this.userInfo.id, targetDate, {
                    group_id: groupId
                })

                // Update local state if it's today
                if (targetDate === user.getTodayDate()) {
                    this.userInfo.group_id = groupId
                    user.saveToCache(this.userInfo)
                }

                console.log(`✅ User assigned to group ${groupId} for ${targetDate}`)
            } catch (err) {
                console.error('Error assigning user to group:', err)
                throw err
            }
        },

        /**
         * Assign user to a bus for a specific date
         * @param {number} busId - Bus number
         * @param {string} date - Date in YYYY-MM-DD format (default: today)
         */
        async assignUserToBus(busId, date = null) {
            const user = useUser()
            const targetDate = date || user.getTodayDate()

            try {
                if (!this.userInfo.id) {
                    throw new Error('User not loaded')
                }

                await user.upsertScheduleField(this.userInfo.id, targetDate, {
                    bus_id: busId
                })

                // Update local state if it's today
                if (targetDate === user.getTodayDate()) {
                    this.userInfo.bus_id = busId
                    user.saveToCache(this.userInfo)
                }

                console.log(`✅ User assigned to bus ${busId} for ${targetDate}`)
            } catch (err) {
                console.error('Error assigning user to bus:', err)
                throw err
            }
        },

        /**
         * Update user presence status
         * @param {number} status - 0 (absent) or 1 (present)
         * @param {string} date - Date in YYYY-MM-DD format (default: today)
         */
        async updateUserPresence(status, date = null) {
            const user = useUser()
            const targetDate = date || user.getTodayDate()

            try {
                if (!this.userInfo.id) {
                    throw new Error('User not loaded')
                }

                const isPresentValue = status === 1 ? 1 : 0

                await user.upsertScheduleField(this.userInfo.id, targetDate, {
                    isPresentToday: isPresentValue
                })

                // Update local state if it's today
                if (targetDate === user.getTodayDate()) {
                    this.userInfo.isPresentToday = isPresentValue === 1
                    user.saveToCache(this.userInfo)
                }

                console.log(`✅ User presence updated to ${isPresentValue} for ${targetDate}`)
            } catch (err) {
                console.error('Error updating user presence:', err)
                throw err
            }
        },

        /**
         * Subscribe to Realtime updates for user status (admin only)
         * @returns {Promise<void>}
         */
        async subscribeToUserStatus() {
            const user = useUser()

            try {
                const authUser = await user.getAuthUser()
                if (!authUser) return

                // Subscribe only if admin
                if (this.userInfo.role !== 'admin') return

                // Unsubscribe previous if any
                if (this.userStatusChannel) {
                    await user.removeRealtimeSubscription(this.userStatusChannel)
                }

                this.userStatusChannel = await user.createRealtimeSubscription(
                    authUser.id,
                    (payload) => {
                        // Handle realtime updates here if needed
                        // This is where you can add custom logic for realtime events
                    }
                )
            } catch (err) {
                console.error('Error while subscribing to Realtime:', err)
            }
        },

        /**
         * Get user's schedule info for a specific date
         * @param {string} date - Date in YYYY-MM-DD format (default: today)
         * @returns {Object} { group_id, bus_id, bMustWorkToday, isPresentToday, description }
         */
        async getUserDayInfo(date = null) {
            const user = useUser()
            const targetDate = date || user.getTodayDate()

            try {
                if (!this.userInfo.id) {
                    throw new Error('User not loaded')
                }

                const data = await user.fetchScheduleForDate(this.userInfo.id, targetDate)

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
    }
})