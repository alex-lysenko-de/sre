import { defineStore } from 'pinia'
import { supabase } from '../supabase'

const CONFIG_CACHE_KEY = 'app_config_cache'
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 минут

// Типы конфигурации для удобного доступа
const CONFIG_KEYS = {
    YEAR: 'year',
    PUBLIC_PHONE_NUMBER: 'public_phone_number',
    TOTAL_GROUPS: 'total_groups',
    TOTAL_BUSES: 'total_buses',
    BASE_URL: 'base_url',
    ANKUNFTSZEIT: 'ankunftszeit',
    ABFAHRTSZEIT: 'abfahrtszeit'
}

export const useConfigStore = defineStore('config', {
    state: () => ({
        configData: {},
        loading: false,
        error: null,
        lastFetch: 0,
        subscription: null
    }),

    getters: {
        // ==================== СТАРЫЕ ГЕТТЕРЫ (DEPRECATED) ====================
        /**
         * @deprecated Используйте отдельные типизированные геттеры вместо этого
         */
        config: (state) => state.configData,

        /**
         * @deprecated Используйте getConfigValueSafe() вместо этого
         */
        getConfigValue: (state) => (key) => state.configData[key],

        // ==================== НОВЫЕ ТИПИЗИРОВАННЫЕ ГЕТТЕРЫ ====================
        /**
         * Год проведения программы
         */
        year: (state) => state.configData[CONFIG_KEYS.YEAR],

        /**
         * Публичный номер телефона
         */
        publicPhoneNumber: (state) => state.configData[CONFIG_KEYS.PUBLIC_PHONE_NUMBER],

        /**
         * Общее количество групп (автоматически преобразуется в число)
         */
        totalGroups: (state) => parseInt(state.configData[CONFIG_KEYS.TOTAL_GROUPS]) || 0,

        /**
         * Общее количество автобусов (автоматически преобразуется в число)
         */
        totalBuses: (state) => parseInt(state.configData[CONFIG_KEYS.TOTAL_BUSES]) || 0,

        /**
         * Базовый URL приложения
         */
        baseUrl: (state) => state.configData[CONFIG_KEYS.BASE_URL],

        /**
         * Время прибытия (например, '17:00')
         */
        ankunftszeit: (state) => state.configData[CONFIG_KEYS.ANKUNFTSZEIT],

        /**
         * Время отправления (например, '08:30')
         */
        abfahrtszeit: (state) => state.configData[CONFIG_KEYS.ABFAHRTSZEIT],

        // ==================== СТАРЫЕ СОСТОЯНИЯ ====================
        isLoading: (state) => state.loading,
        hasError: (state) => state.error !== null
    },

    actions: {
        // ==================== СТАРЫЕ МЕТОДЫ (ОРИГИНАЛЬНАЯ ЛОГИКА) ====================
        async fetchFromSupabase() {
            this.loading = true
            const { data, error: err } = await supabase.from('config').select('*').order('sort_order', { ascending: true })
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
            await this.loadConfig()
            this.subscribeToRealtime()
        },

        // ==================== НОВЫЕ МЕТОДЫ ====================

        /**
         * Безопасное получение значения конфигурации с значением по умолчанию
         * @param {string} key - Ключ конфигурации
         * @param {*} defaultValue - Значение по умолчанию, если ключ не найден
         * @returns {*} Значение конфигурации или значение по умолчанию
         */
        getConfigValueSafe(key, defaultValue = null) {
            return this.configData[key] ?? defaultValue
        },

        /**
         * Получить число из конфигурации с обработкой ошибок
         * @param {string} key - Ключ конфигурации
         * @param {number} defaultValue - Значение по умолчанию (по умолчанию 0)
         * @returns {number} Преобразованное число или значение по умолчанию
         */
        getConfigAsNumber(key, defaultValue = 0) {
            const value = this.configData[key]
            const parsed = parseInt(value)
            return isNaN(parsed) ? defaultValue : parsed
        },

        /**
         * Проверить, загружена ли конфигурация
         * @returns {boolean} true, если конфигурация загружена
         */
        isConfigLoaded() {
            return Object.keys(this.configData).length > 0
        },

        /**
         * Получить все значения конфигурации (без кеша)
         * @returns {object} Полный объект конфигурации
         */
        getAllConfig() {
            return { ...this.configData }
        },

        /**
         * Очистить кеш конфигурации
         */
        clearCache() {
            try {
                localStorage.removeItem(CONFIG_CACHE_KEY)
            } catch (e) {
                console.warn('Ошибка при очистке кеша:', e)
            }
        }
    }
})

// Экспортируем константы для использования в других модулях
export { CONFIG_KEYS }