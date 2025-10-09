import { createRouter, createWebHistory } from 'vue-router'
import InfoView from '@/views/InfoView.vue'
import ConfigView from '@/views/ConfigView.vue'
import LoginView from '@/views/LoginView.vue'
import InviteGeneratorView from '@/views/InviteGeneratorView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import { supabase } from '@/supabase'

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
        redirect: '/info'
    },
    {
        path: '/info',
        name: 'Info',
        component: InfoView,
        meta: { requiresAuth: false }
    },
    {
        path: '/config',
        name: 'Config',
        component: ConfigView,
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/invite',
        name: 'InviteGenerator',
        component: InviteGeneratorView,
        meta: { requiresAuth: true, requiresAdmin: true }
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

// Globaler Guard zur Überprüfung der Authentifizierung
router.beforeEach(async (to, from, next) => {
    // Öffentliche Seiten
    if (to.meta.public) {
        return next()
    }

    // Authentifizierung überprüfen
    if (to.meta.requiresAuth) {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                console.log('🚫 Keine aktive Sitzung gefunden, leite zu Login weiter')
                return next('/login')
            }

            // Benutzerdaten aus der 'users'-Tabelle abrufen
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

            // Aktivität überprüfen
            if (!userData.active) {
                console.log('⛔ Konto ist deaktiviert')
                await supabase.auth.signOut()
                alert('Ihr Konto ist deaktiviert')
                return next('/login')
            }

            // Rechte für Admin-Seiten überprüfen
            if (to.meta.requiresAdmin && userData.role !== 'admin') {
                console.log('⛔ Zugriff verweigert: Rolle \'admin\' erforderlich')
                alert('⛔ Zugriff verweigert: Nur für Administratoren!')
                return next('/info')
            }

            // 'last_seen_date' aktualisieren
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

    next()
})

export default router