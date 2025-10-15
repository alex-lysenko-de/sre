import { defineStore } from 'pinia'
import { supabase } from '../supabase'

const CONFIG_CACHE_KEY = 'app_config_cache'
const CONFIG_CACHE_TTL = 5 * 60 * 1000

export const useConfigStore = defineStore('config', {
    state: () => ({
        configData: {},
        loading: false,
        error: null,
        lastFetch: 0,
        isAdmin: false,
        subscription: null
    }),

    getters: {
        config: (state) => state.configData,
        isLoading: (state) => state.loading,
        hasError: (state) => state.error !== null,
        getConfigValue: (state) => (key) => state.configData[key]
    },

    actions: {
        async fetchFromSupabase() {
            this.loading = true
            const { data, error: err } = await supabase.from('config').select('*')
            this.loading = false

            if (err) {
                console.error('Fehler beim Laden der Konfiguration:', err.message)
                this.error = err
                return null
            }

            const result = Object.fromEntries(data.map((i) => [i.key, i.value]))
            this.configData = result
            localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }))
            this.lastFetch = Date.now()
            return result
        },

        async loadConfig(force = false) {
            const cached = localStorage.getItem(CONFIG_CACHE_KEY)
            const now = Date.now()

            if (!force && cached) {
                const { data, timestamp } = JSON.parse(cached)
                if (now - timestamp < CONFIG_CACHE_TTL) {
                    this.configData = data
                    return data
                }
            }

            return await this.fetchFromSupabase()
        },

        async updateConfig(key, value) {
            if (!this.isAdmin) throw new Error('Unzureichende Rechte zur Änderung der Konfiguration')

            const { error: err } = await supabase
                .from('config')
                .update({ value, updated_at: new Date().toISOString() })
                .eq('key', key)

            if (err) throw err

            this.configData[key] = value
            localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ data: this.configData, timestamp: Date.now() }))
        },

        subscribeToRealtime() {
            if (this.subscription) return

            this.subscription = supabase
                .channel('public:config')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, async () => {
                    console.log('⚡ Konfigurations-Update über WebSocket empfangen')
                    await this.fetchFromSupabase()
                })
                .subscribe((status) => console.log('📡 Realtime-Status:', status))
        },

        unsubscribeFromRealtime() {
            if (this.subscription) {
                supabase.removeChannel(this.subscription)
                this.subscription = null
            }
        },

        async initConfigModule() {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                // Get the actual role from the users table
                const { data: userData } = await supabase
                    .from('users')
                    .select('role')
                    .eq('user_id', user.id)
                    .single()

                this.isAdmin = userData?.role === 'admin'
            } else {
                this.isAdmin = false
            }

            await this.loadConfig()
            this.subscribeToRealtime()
        }
    }
})