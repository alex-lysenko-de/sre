import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { registerSW } from 'virtual:pwa-register'

// Import Bootstrap CSS and JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'

// Font Awesome setup
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'

// Import all actually used icons (in alphabetical order for convenience)
import {
    faArrowLeft,
    faBus,
    faCalendarAlt,
    faCalendarCheck,
    faCheck,
    faCheckCircle,
    faChild,
    faChildren,
    faCity,
    faCog,
    faComment,
    faDoorOpen,
    faEdit,
    faEnvelope,
    faEuroSign,
    faExclamationTriangle,
    faHand,
    faHome,
    faInfoCircle,
    faLock,
    faMapMarkerAlt,
    faPhone,
    faPlus,
    faSave,
    faThumbsUp,
    faTimes,
    faTrashAlt,
    faTree,
    faUser,
    faUserPlus,
    faUsers,
    faQrcode,
    faArrowRight,
    faChartLine,
} from '@fortawesome/free-solid-svg-icons'

// Add them to library
library.add(
    faArrowLeft,
    faBus,
    faCalendarAlt,
    faCalendarCheck,
    faCheck,
    faCheckCircle,
    faChild,
    faChildren,
    faCity,
    faCog,
    faComment,
    faDoorOpen,
    faEdit,
    faEnvelope,
    faEuroSign,
    faExclamationTriangle,
    faHand,
    faHome,
    faInfoCircle,
    faLock,
    faMapMarkerAlt,
    faPhone,
    faPlus,
    faSave,
    faThumbsUp,
    faTimes,
    faTrashAlt,
    faTree,
    faUser,
    faUserPlus,
    faUsers,
    faQrcode,
    faArrowRight,
    faWhatsapp,
    faChartLine
)

// Create Pinia instance
const pinia = createPinia()

const app = createApp(App)
app.use(pinia) // Register Pinia before router
app.use(router)

// === new code for async global initialization of config store ===
import { useConfigStore } from '@/stores/config'

// run async initialization before mounting the app
const configStore = useConfigStore()
await configStore.initConfigModule()
// =========================================================

// Register the FontAwesomeIcon component globally
app.component('font-awesome-icon', FontAwesomeIcon)
app.mount('#app')

// Register Service Worker with auto-update
const updateSW = registerSW({
    onNeedRefresh() {
        // New version found
        console.log('🌀 Neue Version der App gefunden!')
        updateSW(true).then(r => console.log('version is updated'))
    },
    onOfflineReady() {
        console.log('✅ App ist bereit für Offline-Betrieb')
    },
})