import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

const CONFIG_CACHE_KEY = 'app_config_cache'
const CONFIG_CACHE_TTL = 5 * 60 * 1000

const configData = ref({})
const loading = ref(false)
const error = ref(null)
const lastFetch = ref(0)
const isAdmin = ref(false)
let subscription = null

async function fetchFromSupabase() {
    loading.value = true
    const { data, error: err } = await supabase.from('config').select('*')
    loading.value = false

    if (err) {
        console.error('Fehler beim Laden der Konfiguration:', err.message)
        error.value = err
        return null
    }

    const result = Object.fromEntries(data.map((i) => [i.key, i.value]))
    configData.value = result
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }))
    lastFetch.value = Date.now()
    return result
}

async function loadConfig(force = false) {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY)
    const now = Date.now()

    if (!force && cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (now - timestamp < CONFIG_CACHE_TTL) {
            configData.value = data
            return data
        }
    }

    return await fetchFromSupabase()
}

async function updateConfig(key, value) {
    if (!isAdmin.value) throw new Error('Unzureichende Rechte zur Änderung der Konfiguration')

    const { error: err } = await supabase
        .from('config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)

    if (err) throw err

    configData.value[key] = value
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ data: configData.value, timestamp: Date.now() }))
}

function subscribeToRealtime() {
    if (subscription) return

    subscription = supabase
        .channel('public:config')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, async () => {
            console.log('⚡ Konfigurations-Update über WebSocket empfangen')
            await fetchFromSupabase()
        })
        .subscribe((status) => console.log('📡 Realtime-Status:', status))
}

function unsubscribeFromRealtime() {
    if (subscription) {
        supabase.removeChannel(subscription)
        subscription = null
    }
}

async function initConfigModule() {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        // Get the actual role from the users table
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', user.id)
            .single()

        isAdmin.value = userData?.role === 'admin'
    } else {
        isAdmin.value = false
    }

    await loadConfig()
    subscribeToRealtime()
}

onUnmounted(unsubscribeFromRealtime)

export function useConfig() {
    onMounted(() => subscribeToRealtime())
    return {
        config: configData,
        loadConfig,
        updateConfig,
        isAdmin,
        loading,
        error,
        initConfigModule,
    }
}