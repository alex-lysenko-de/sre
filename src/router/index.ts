// router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('../views/RegisterView.vue'),
        meta: { requiresAuth: false }
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('../views/LoginView.vue'),
        meta: { requiresAuth: false }
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/admin',
        name: 'Admin',
        component: () => import('../views/AdminPanel.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/profile',
        name: 'Profile',
        component: () => import('../views/ProfileView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/devices',
        name: 'Devices',
        component: () => import('../views/DevicesView.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/offline',
        name: 'Offline',
        component: () => import('../views/OfflineView.vue'),
        meta: { requiresAuth: false }
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('../views/NotFoundView.vue')
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0 };
        }
    }
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
    const { isAuthenticated, user, initialize } = useAuth();

    // Инициализация при первой загрузке
    if (!isAuthenticated.value && !user.value) {
        await initialize();
    }

    // Проверка авторизации
    if (to.meta.requiresAuth && !isAuthenticated.value) {
        // Если есть invite token в URL, разрешить доступ к регистрации
        if (to.query.invite) {
            next({ name: 'Register', query: { invite: to.query.invite as string } });
        } else {
            next({ name: 'Login', query: { redirect: to.fullPath } });
        }
        return;
    }

    // Проверка прав администратора
    if (to.meta.requiresAdmin && user.value?.role !== 'admin') {
        next({ name: 'Dashboard' });
        return;
    }

    // Редирект авторизованных пользователей со страниц логина/регистрации
    if (isAuthenticated.value && (to.name === 'Login' || to.name === 'Register')) {
        next({ name: 'Dashboard' });
        return;
    }

    next();
});

export default router;