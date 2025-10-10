<script setup>
import { useRouter } from 'vue-router';
// Допустим, у вас есть composable для текущего пользователя и его роли
// import { useAuth } from '@/composables/useAuth';
// const { userRole } = useAuth(); // 'guest', 'user', 'admin'

const router = useRouter();

const navigation = [
  { name: 'Сканирование', path: '/main/scan', icon: 'qr-code' },
  { name: 'Дети', path: '/main/children', icon: 'people' },
  { name: 'Привязка браслета', path: '/main/bind', icon: 'link' },
  // Этот элемент будет отображаться только для Admin, 
  // но Router Guard запретит доступ, если его нет в meta.role
  { name: 'Управление пользователями', path: '/main/users', icon: 'settings', requiredRole: 'admin' },
];

const goTo = (path) => {
  router.push(path);
};

// Функция для имитации проверки роли (пока не подключен useAuth)
// В реальном проекте здесь будет проверка userRole === item.requiredRole
const checkAccess = (item) => {
    // Временно разрешаем все, чтобы увидеть навигацию, 
    // но роутер-гуард всё равно заблокирует /users
    return !item.requiredRole || item.requiredRole === 'user' || item.requiredRole === 'admin';
};
</script>

<template>
  <div class="main-layout flex h-screen bg-gray-50">
    
    <aside class="w-64 bg-white shadow-xl p-4 flex flex-col">
      <h1 class="text-xl font-bold mb-6 text-indigo-600">Система Сканирования</h1>
      <nav>
        <button 
          v-for="item in navigation"
          :key="item.path"
          @click="goTo(item.path)"
          :class="['w-full text-left p-3 rounded-lg my-1 transition-colors', 
                   $route.path.startsWith(item.path) ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-100']"
        >
          {{ item.name }}
          </button>
      </nav>
      <div class="mt-auto pt-4 border-t">
        <button @click="router.push('/info')" class="text-sm text-gray-500 hover:text-indigo-600">
          Выход / Информация
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-auto p-8">
      <header class="mb-6 pb-4 border-b">
          <h2 class="text-2xl font-light text-gray-800">{{ $route.meta.title || 'Рабочая Область' }}</h2>
      </header>

      <router-view /> 
    </main>

  </div>
</template>

<style scoped>
/* Добавьте стили Tailwind или собственные стили по необходимости */
</style>