import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { registerSW } from 'virtual:pwa-register'

// Import Bootstrap CSS and JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'

const app = createApp(App)
app.use(router)
app.mount('#app')

// Register Service Worker with auto-update
const updateSW = registerSW({
    onNeedRefresh() {
        // New version found
        console.log('🌀 Neue Version der App gefunden!')
        updateSW(true) // Apply new version immediately
    },
    onOfflineReady() {
        console.log('✅ App ist bereit für Offline-Betrieb')
    },
})