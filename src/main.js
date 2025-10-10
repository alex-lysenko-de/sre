import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { registerSW } from 'virtual:pwa-register'

// Import Bootstrap CSS and JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'

// Font Awesome setup
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// Импортируешь все реально используемые иконки (в алфавитном порядке для удобства)
import {
    faArrowLeft,
    faCalendarAlt,
    faCheck,
    faChild,
    faCity,
    faCog,
    faComment,
    faDoorOpen,
    faEdit,
    faEnvelope,
    faEuroSign,
    faExclamationTriangle,
    faHand, // Замена для 👋
    faHome,
    faInfoCircle, // Замена для ℹ️
    faLock, // Замена для 🔒
    faMapMarkerAlt,
    faPhone,
    faPlus,
    faSave, // Замена для 💾
    faThumbsUp, // Замена для 👍
    faTimes,
    faTrashAlt,
    faTree, // Замена для 🌳
    faUser, // Замена для 👤
    faUserPlus,
    faUsers // Замена для 👥
} from '@fortawesome/free-solid-svg-icons'

// Добавляешь только их
library.add(
    faArrowLeft,
    faCalendarAlt,
    faCheck,
    faChild,
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
    faUsers
)

const app = createApp(App)
app.use(router)

// Register the FontAwesomeIcon component globally
app.component('font-awesome-icon', FontAwesomeIcon)

app.mount('#app')

// Register Service Worker with auto-update
const updateSW = registerSW({
    onNeedRefresh() {
        // New version found
        console.log('🌀 Neue Version der App gefunden!')
        updateSW(true).then(r => console.log('version is updated')) // Apply new version immediately
    },
    onOfflineReady() {
        console.log('✅ App ist bereit für Offline-Betrieb')
    },
})