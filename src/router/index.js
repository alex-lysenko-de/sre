import { createRouter, createWebHistory } from 'vue-router'
import InfoView from '@/views/InfoView.vue'
import ConfigView from '@/views/ConfigView.vue'
import LoginView from '@/views/LoginView.vue'
import InviteGeneratorView from '@/views/InviteGeneratorView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import { supabase } from '@/supabase'
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
        path: '/group-edit/:id',
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
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

// Global navigation guard
router.beforeEach(async (to, from, next) => {
    // Prüfen, ob der Nutzer jemals registriert wurde
    const isRegistered = localStorage.getItem('sre_user_registered') === 'true'

    // --- ЛОГИКА ДЛЯ ГОСТЕЙ ---
    if (!isRegistered) {
        // Gäste dürfen nur auf öffentliche Seiten und die Willkommens-Seite zugreifen
        if (to.meta.public || to.name === 'Welcome' || to.name === 'Main' || to.name === 'Info') {
            return next()
        }
        // Wenn ein Gast versucht, eine andere Seite aufzurufen, wird er zur Info-Seite geleitet
        if (to.path !== '/info') {
            console.log('👤 Gast erkannt, leite zu /info weiter');
            return next('/info');
    }
        return next();
    }

    // --- ЛОГИКА ДЛЯ ЗАРЕГИСТРИРОВАННЫХ ПОЛЬЗОВАТЕЛЕЙ ---
    // Public pages
    if (to.meta.public) {
        return next()
    }

    // Check authentication
    if (to.meta.requiresAuth) {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                console.log('🚫 Keine aktive Sitzung gefunden, leite zu Login weiter')
                return next('/login')
            }

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