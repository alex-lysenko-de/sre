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
    faWhatsapp
)

// Create Pinia instance
const pinia = createPinia()

const app = createApp(App)
app.use(pinia) // Register Pinia before router
app.use(router)

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