import { createRouter, createWebHistory } from 'vue-router'
import InfoView from '@/views/InfoView.vue'
import ConfigView from '@/views/ConfigView.vue'
import LoginView from '@/views/LoginView.vue'
import InviteGeneratorView from '@/views/InviteGeneratorView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import { supabase } from '@/supabase'
import { getAuthItem } from '@/modules/storage'
import ChildrenView from '@/views/ChildrenView.vue'
import UsersView from '@/views/UsersView.vue'
import GroupEditView from '@/views/GroupEditView.vue'
import DaysEditView from '@/views/DaysEditView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import ArmbandConnectView from '@/views/ArmbandConnectView.vue'
import ArmbandView from '@/views/ArmbandView.vue'
import SelectChildView from "@/views/SelectChildView.vue"
import ChildDetailView from "@/views/ChildDetailView.vue"
import ChildEditView from "@/views/ChildEditView.vue"
import MainView from "@/views/MainView.vue"
import AdminBusView from "@/views/AdminBusView.vue";

// Define routes
const routes = [
    {
        path: '/login',
        name: 'Login',
        component: LoginView,
        meta: { public: true }
    },
    {
        path: '/welcome',
        name: 'Welcome',
        component: WelcomeView,
        meta: { public: true }
    },
    {
        path: '/',
        redirect: '/main'
    },
    {
        path: '/main',
        name: 'Main',
        component: MainView,
        meta: { requiresAuth: false }
    },
    {
        path: '/admin-busses',
        name: 'AdminBus',
        component: AdminBusView,
        meta: { requiresAuth: true, requiresAdmin: true}
    },

    {
        path: '/children',
        name: 'Children',
        component: ChildrenView,
        meta: { requiresAuth: true, requiresAdmin: true}
    },
    {
        path: '/armband/:id',
        name: 'Armband',
        component: ArmbandView,
        meta: { requiresAuth: true, title: 'Armband Scannen' }
    },
    {
        path: '/info',
        name: 'Info',
        component: InfoView,
        meta: { requiresAuth: false }
    },
    {
        path: '/group-edit/:id?',
        name: 'GroupEdit',
        component: GroupEditView,
        meta: { requiresAuth: true, requiresAdmin: false }
    },
    {
        path: '/select-child',
        name: 'SelectChild',
        component: SelectChildView,
        meta: { requiresAuth: true, requiresAdmin: false }
    },

    {
        path: '/headcount',
        name: 'Headcount',
        // Lazy wie die Scanner-Routen (Ticket 120) - HeadcountView bindet seit
        // Ticket 123 Scanner.vue ein, das ueber html5-qrcode einen grossen
        // Teil zum Bundle beitraegt (siehe tickets/123/IMPLEMENTATION_REPORT.md).
        component: () => import('@/views/HeadcountView.vue'),
        meta: { requiresAuth: true, requiresAdmin: false }
    },

    {
        path: '/scanner/bus',
        name: 'ScannerBus',
        component: () => import('@/views/ScannerBusView.vue'),
        meta: { requiresAuth: true, requiresAdmin: false }
    },

    {
        path: '/scanner/group',
        name: 'ScannerGroup',
        component: () => import('@/views/ScannerGroupView.vue'),
        meta: { requiresAuth: true, requiresAdmin: false }
    },

    {
        path: '/scanner/checkin',
        name: 'ScannerCheckin',
        component: () => import('@/views/ScannerCheckinView.vue'),
        meta: { requiresAuth: true, requiresAdmin: false }
    },

    {
        path: '/scanner/settings',
        name: 'ScannerSettings',
        component: () => import('@/views/ScannerSettingsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: false }
    },


    {
        path: '/child/:id',
        name: 'ChildDetail',
        component: ChildDetailView,
        meta: { requiresAuth: true, requiresAdmin: false }
    },
    {
        path: '/child-edit/:id',
        name: 'ChildDetailEdit',
        component: ChildEditView,
        meta: { requiresAuth: true, requiresAdmin: false }
    },
    {
        path: '/armband-connect/:id',
        name: 'ArmbandConnect',
        component: ArmbandConnectView,
        meta: { requiresAuth: true, title: 'Armband Verbinden' }
    },
    {
        path: '/days-edit',
        name: 'DaysEdit',
        component: DaysEditView,
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/config',
        name: 'Config',
        component: ConfigView,
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/users-edit',
        name: 'UsersEdit',
        component: UsersView,
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/invite',
        name: 'InviteGenerator',
        component: InviteGeneratorView,
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/reset-password',
        name: 'ResetPassword',
        component: ResetPasswordView,
        meta: { requiresAuth: true }
    },

    // Ticket 130_2 - UI-Prototyp "Checkpoint" (mock-Daten, kein Supabase-
    // Zugriff). Isolierter Namensraum, ersetzt /admin-busses/-children
    // nicht - siehe tickets/130_2/IMPLEMENTATION_PLAN.md.
    {
        path: '/admin/checkpoints-prototype',
        name: 'CheckpointListPrototype',
        component: () => import('@/views/CheckpointListPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/bus/:id',
        name: 'CheckpointBusPrototype',
        component: () => import('@/views/CheckpointBusPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/group/:id',
        name: 'CheckpointGroupPrototype',
        component: () => import('@/views/CheckpointGroupPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/lazy/:id',
        name: 'CheckpointLazyPrototype',
        component: () => import('@/views/CheckpointLazyPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },

    // UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung) - neue,
    // ueberall wiederverwendbare Entitaeten-Bildschirme (Kind/Betreuer/
    // Gruppe/universelle Liste), siehe tickets/130_2 Planungsnotizen.
    {
        path: '/admin/checkpoints-prototype/list',
        name: 'CheckpointEntityListPrototype',
        component: () => import('@/views/EntityListPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/child/:id/edit',
        name: 'CheckpointChildEditPrototype',
        component: () => import('@/views/ChildEditPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/child/:id',
        name: 'CheckpointChildCardPrototype',
        component: () => import('@/views/ChildCardPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/betreuer/:id',
        name: 'CheckpointBetreuerCardPrototype',
        component: () => import('@/views/BetreuerCardPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints-prototype/group-entity/:id',
        name: 'CheckpointGroupEntityPrototype',
        component: () => import('@/views/GroupEntityPrototypeView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },

    // Ticket 134 - reale Checkpoint-Bildschirme (List/Bus/Group), Supabase
    // statt Mock. Kein Eintrag in MainView.vue - Direktnavigation per Route,
    // siehe tickets/134/134.txt Kopfabschnitt (Menu-Umbau erst Ticket 137).
    {
        path: '/admin/checkpoints',
        name: 'CheckpointList',
        component: () => import('@/views/CheckpointListView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints/bus/:id',
        name: 'CheckpointBus',
        component: () => import('@/views/CheckpointBusView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints/group/:id',
        name: 'CheckpointGroup',
        component: () => import('@/views/CheckpointGroupView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },

    // Ticket 133 - reale Entity-Bildschirme (Kind/Betreuer/Gruppe/
    // universelle Liste), Supabase statt Mock. Namensraum ohne
    // -prototype-Suffix, siehe tickets/131/IMPLEMENTATION_PLAN.md, "UI
    // изменения".
    {
        path: '/admin/checkpoints/list',
        name: 'CheckpointEntityList',
        component: () => import('@/views/EntityListView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints/child/:id',
        name: 'CheckpointChildCard',
        component: () => import('@/views/ChildCardView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints/betreuer/:id',
        name: 'CheckpointBetreuerCard',
        component: () => import('@/views/BetreuerCardView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/checkpoints/group-entity/:id',
        name: 'CheckpointGroupEntity',
        component: () => import('@/views/GroupEntityView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

// Global navigation guard
router.beforeEach(async (to, from, next) => {
    // Prüfen, ob der Nutzer jemals registriert wurde
    let isRegistered = false
    try {
        isRegistered = await getAuthItem('sre_user_registered') === 'true'
    } catch (err) {
        console.error('❌ Fehler beim Lesen des Registrierungsstatus:', err)
    }

    // Sitzung wird jetzt immer geprüft, unabhängig vom Registrierungsflag
    // (Flag allein ist auf iOS unzuverlässig, siehe tickets/112)
    let session = null
    try {
        const result = await supabase.auth.getSession()
        session = result.data.session
    } catch (err) {
        console.error('❌ Fehler bei der Sitzungsprüfung:', err)
    }

    // --- ЛОГИКА ДЛЯ ОТСУТСТВУЮЩЕЙ СЕССИИ ---
    if (!session) {
        if (to.meta.public) {
            return next()
        }

        if (!isRegistered) {
            // Gäste dürfen nur auf öffentliche Seiten und die Willkommens-Seite zugreifen
            if (to.name === 'Welcome' || to.name === 'Main' || to.name === 'Info') {
                return next()
            }
            // Wenn ein Gast versucht, eine andere Seite aufzurufen, wird er zur Info-Seite geleitet
            if (to.path !== '/info') {
                console.log('👤 Gast erkannt, leite zu /info weiter');
                return next('/info');
            }
            return next();
        }

        // Gerät war bereits registriert, aber aktuell keine gültige Sitzung
        if (to.name !== 'Login') {
            console.log('🚫 Keine aktive Sitzung gefunden, leite zu Login weiter')
            return next('/login')
        }
        return next()
    }

    // --- ЛОГИКА ДЛЯ АКТИВНОЙ СЕССИИ ---
    // Public pages
    if (to.meta.public) {
        return next()
    }

    // Check authentication
    if (to.meta.requiresAuth) {
        try {
            // Get user data from 'users' table
            const { data: userData, error } = await supabase
                .from('users')
                .select('role, active')
                .eq('user_id', session.user.id)
                .single()

            if (error || !userData) {
                console.error('❌ Fehler beim Abrufen der Benutzerdaten:', error)
                await supabase.auth.signOut()
                return next('/login')
            }

            // Check if user is active
            if (!userData.active) {
                console.log('⛔ Konto ist deaktiviert')
                await supabase.auth.signOut()
                alert('Ihr Konto ist deaktiviert')
                return next('/login')
            }

            // Check admin rights for admin pages
            if (to.meta.requiresAdmin && userData.role !== 'admin') {
                console.log('⛔ Zugriff verweigert: Rolle \'admin\' erforderlich')
                alert('⛔ Zugriff verweigert: Nur für Administratoren!')
                return next('/main')
            }

            // Update 'last_seen_date'
            supabase
                .from('users')
                .update({ last_seen_date: new Date().toISOString() })
                .eq('user_id', session.user.id)
                .then(() => console.log('📅 Zeit des letzten Besuchs aktualisiert'))

            return next()
        } catch (err) {
            console.error('❌ Fehler bei der Berechtigungsprüfung:', err)
            return next('/login')
        }
    }

    // Check for ?id=123 or ?n=123 in URL for child id and redirect to /armband/:id
    if (to.query.id || to.query.n) {
        const childId = to.query.id || to.query.n
        console.log('➡️ Umleitung zu /armband/' + childId)
        return next({ name: 'Armband', params: { id: childId } })
    }

    next()
})

export default router