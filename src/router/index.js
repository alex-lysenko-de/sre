// src/router/index.js (Фрагмент, который нужно обновить/добавить)

// 1. Импортируем MainView и все дочерние View
import MainView from '@/views/MainView.vue';
import ScanView from '@/views/ScanView.vue';
import ChildrenView from '@/views/ChildrenView.vue';
import ChildDetailView from '@/views/ChildDetailView.vue';
import BindBraceletView from '@/views/BindBraceletView.vue';
import UsersView from '@/views/UsersView.vue';
// !!! Также создайте эти файлы с минимальным <template>...</template> 
//     чтобы избежать ошибок при запуске.

// ... (Остальные импорты)

const router = createRouter({
    // ... (history, base)
    routes: [
        {
            path: '/',
            redirect: '/main/scan' // Делаем рабочую область точкой входа
        },
        // ... (Существующие роуты: /login, /info)

        // Новый главный Layout
        {
            path: '/main',
            name: 'Main',
            component: MainView,
            // Требование: только для авторизованных (по умолчанию user/admin).
            // Если guard уже проверяет 'requiresAuth', то здесь это можно опустить.
            meta: { requiresAuth: true, title: 'Рабочая Область' },
            children: [
                {
                    path: 'scan',
                    name: 'Scan',
                    component: ScanView,
                    meta: { title: 'Сканирование QR', role: ['user', 'admin'] }
                },
                {
                    path: 'children',
                    name: 'Children',
                    component: ChildrenView,
                    meta: { title: 'Список детей', role: ['user', 'admin'] }
                },
                {
                    path: 'child/:id',
                    name: 'ChildDetail',
                    component: ChildDetailView,
                    meta: { title: 'Карточка ребёнка', role: ['user', 'admin'] }
                },
                {
                    path: 'bind',
                    name: 'BindBracelet',
                    component: BindBraceletView,
                    meta: { title: 'Привязка браслета', role: ['user', 'admin'] }
                },
                {
                    path: 'users',
                    name: 'Users',
                    component: UsersView,
                    // Тикет 1: доступ только для Admin
                    meta: { title: 'Управление пользователями', role: ['admin'] }
                }
            ]
        },
        // ... (Обработка 404)
    ]
});


// Глобальный Guard: Расширяем для проверки ролей (Тикет 1, Acceptance criterion 2)
router.beforeEach(async (to, from, next) => {
    // 1. Проверка авторизации (если она уже есть, то используем ее)
    const isAuthenticated = /* логика проверки сессии supabase */;
    const currentUserRole = /* логика получения роли из users */; // 'guest', 'user', 'admin'

    if (to.meta.requiresAuth && !isAuthenticated) {
        return next({ path: '/login', query: { redirect: to.fullPath } });
    }

    // 2. Проверка ролей (Дополнение к вашему существующему guard)
    if (to.meta.role && !to.meta.role.includes(currentUserRole)) {
        // Запрещён доступ: редирект на /info (или другую страницу ошибки)
        console.warn(`Доступ запрещен для роли: ${currentUserRole} на маршруте: ${to.path}`);
        return next({ path: '/info' });
    }

    next();
});

// export default router;