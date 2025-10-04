<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Welcome Header -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h1 class="text-3xl font-bold text-gray-900">
        Добро пожаловать, {{ user?.displayName }}!
      </h1>
      <p class="text-gray-600 mt-2">
        Последний вход: {{ lastSeenFormatted }}
      </p>
    </div>

    <!-- Daily Check-in -->
    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-md p-6 mb-6 text-white">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold">Ежедневная отметка</h2>
          <p class="mt-2 text-indigo-100">
            {{ checkedInToday ? 'Вы уже отметились сегодня!' : 'Отметьтесь, чтобы продолжить' }}
          </p>
        </div>
        <div>
          <button
              v-if="!checkedInToday"
              @click="checkIn"
              :disabled="isCheckingIn"
              class="bg-white text-indigo-600 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-50 transition disabled:opacity-50"
          >
            {{ isCheckingIn ? 'Отметка...' : 'Отметиться' }}
          </button>
          <div v-else class="text-center">
            <svg class="w-16 h-16 text-white mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <p class="mt-2 font-medium">Отмечено ✓</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <!-- Active Devices -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Активных устройств</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.activeDevices }}</p>
          </div>
        </div>
      </div>

      <!-- Login Streak -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Дней подряд</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.loginStreak }}</p>
          </div>
        </div>
      </div>

      <!-- Account Status -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Статус аккаунта</p>
            <p class="text-2xl font-bold text-gray-900">
              {{ user?.role === 'admin' ? 'Админ' : 'Активен' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Быстрые действия</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <router-link
            to="/profile"
            class="flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
        >
          <svg class="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span class="font-medium text-gray-900">Профиль</span>
        </router-link>

        <router-link
            to="/devices"
            class="flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
        >
          <svg class="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span class="font-medium text-gray-900">Устройства</span>
        </router-link>

        <router-link
            v-if="user?.role === 'admin'"
            to="/admin"
            class="flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
        >
          <svg class="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="font-medium text-gray-900">Админ-панель</span>
        </router-link>

        <button
            @click="refreshAuth"
            class="flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
        >
          <svg class="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span class="font-medium text-gray-900">Обновить</span>
        </button>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-white rounded-lg shadow-md p-6 mt-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Последняя активность</h2>
      <div class="space-y-4">
        <div v-for="(activity, index) in recentActivity" :key="index" class="flex items-start border-l-4 border-indigo-500 pl-4 py-2">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">{{ activity.action }}</p>
            <p class="text-xs text-gray-500">{{ activity.timestamp }}</p>
          </div>
        </div>
        <p v-if="recentActivity.length === 0" class="text-gray-500 text-sm text-center py-4">
          Нет активности
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { user, apiRequest, login } = useAuth();

const isCheckingIn = ref(false);
const checkedInToday = ref(false);
const stats = ref({
  activeDevices: 0,
  loginStreak: 0,
});
const recentActivity = ref<Array<{ action: string; timestamp: string }>>([]);

const lastSeenFormatted = computed(() => {
  if (!user.value) return 'Неизвестно';
  return new Date().toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});

onMounted(async () => {
  await loadDashboardData();
  checkIfCheckedInToday();
});

async function loadDashboardData() {
  try {
    // Загрузить статистику устройств
    const devicesResponse = await apiRequest('/devices/count', {
      method: 'GET',
    });
    const devicesData = await devicesResponse.json();
    stats.value.activeDevices = devicesData.count || 0;

    // Загрузить streak
    stats.value.loginStreak = calculateLoginStreak();

    // Загрузить последнюю активность
    recentActivity.value = [
      { action: 'Вход в систему', timestamp: 'Сегодня, ' + new Date().toLocaleTimeString('ru-RU') },
    ];
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

function checkIfCheckedInToday() {
  // Проверить, отмечался ли пользователь сегодня
  // В реальном приложении это проверяется через API
  const lastCheckIn = localStorage.getItem('lastCheckIn');
  const today = new Date().toDateString();
  checkedInToday.value = lastCheckIn === today;
}

async function checkIn() {
  isCheckingIn.value = true;

  try {
    // Повторная биометрическая аутентификация для отметки
    await login();

    const today = new Date().toDateString();
    localStorage.setItem('lastCheckIn', today);
    checkedInToday.value = true;

    // Добавить в активность
    recentActivity.value.unshift({
      action: 'Ежедневная отметка',
      timestamp: 'Только что',
    });
  } catch (error) {
    console.error('Check-in failed:', error);
    alert('Ошибка при отметке');
  } finally {
    isCheckingIn.value = false;
  }
}

function calculateLoginStreak(): number {
  // В реальном приложении это вычисляется на сервере
  return Math.floor(Math.random() * 30) + 1;
}

async function refreshAuth() {
  try {
    await login();
    await loadDashboardData();
  } catch (error) {
    console.error('Refresh failed:', error);
  }
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style> 