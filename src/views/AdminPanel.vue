<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Админ-панель</h1>
        <p class="text-gray-600 mt-2">Управление пользователями и генерация QR-кодов</p>
      </div>

      <!-- Generate Invite Section -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Создать Invite</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <!-- Role Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Роль
            </label>
            <select
              v-model="inviteRole"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

          <!-- Expiry Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Срок действия
            </label>
            <select
              v-model="inviteExpiryHours"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option :value="1">1 час</option>
              <option :value="24">24 часа</option>
              <option :value="72">3 дня</option>
              <option :value="168">7 дней</option>
            </select>
          </div>
        </div>

        <button
          @click="generateInvite"
          :disabled="isGenerating"
          class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <svg v-if="isGenerating" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-if="!isGenerating">Создать QR-код</span>
          <span v-else>Генерация...</span>
        </button>
      </div>

      <!-- QR Code Display -->
      <div v-if="generatedInvite" class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">QR-код сгенерирован</h2>
        
        <div class="flex flex-col items-center">
          <!-- QR Code Canvas -->
          <div class="bg-white p-6 rounded-lg border-4 border-indigo-600 mb-4">
            <canvas ref="qrCanvas" class="w-64 h-64"></canvas>
          </div>

          <!-- Invite URL -->
          <div class="w-full mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Ссылка для регистрации
            </label>
            <div class="flex">
              <input
                :value="generatedInvite.inviteUrl"
                readonly
                class="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg bg-gray-50 text-sm"
              />
              <button
                @click="copyToClipboard(generatedInvite.inviteUrl)"
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-r-lg transition"
                title="Копировать"
              >
                <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Info -->
          <div class="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="flex-1">
                <h4 class="text-sm font-medium text-blue-900">Информация</h4>
                <ul class="mt-2 text-sm text-blue-800 space-y-1">
                  <li>• Роль: <strong>{{ generatedInvite.role === 'admin' ? 'Администратор' : 'Пользователь' }}</strong></li>
                  <li>• Истекает: <strong>{{ formatDate(generatedInvite.expiresAt) }}</strong></li>
                  <li>• Можно использовать только один раз</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Download Button -->
          <button
            @click="downloadQRCode"
            class="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Скачать QR-код
          </button>
        </div>
      </div>

      <!-- Users List -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Пользователи</h2>
        
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Последний вход</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-900">{{ user.display_name }}</td>
                <td class="px-4 py-3 text-sm">
                  <span
                    :class="user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'"
                    class="px-2 py-1 rounded-full text-xs font-medium"
                  >
                    {{ user.role === 'admin' ? 'Админ' : 'Пользователь' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ user.last_seen_date ? formatDate(user.last_seen_date) : 'Никогда' }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <span
                    :class="user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                    class="px-2 py-1 rounded-full text-xs font-medium"
                  >
                    {{ user.active ? 'Активен' : 'Заблокирован' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <button
                    @click="toggleUserStatus(user)"
                    class="text-indigo-600 hover:text-indigo-900 font-medium"
                  >
                    {{ user.active ? 'Заблокировать' : 'Активировать' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import QRCode from 'qrcode';

const { apiRequest } = useAuth();

interface GeneratedInvite {
  inviteToken: string;
  inviteUrl: string;
  expiresAt: string;
  role: string;
}

interface User {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  last_seen_date: string | null;
}

const inviteRole = ref<'user' | 'admin'>('user');
const inviteExpiryHours = ref(24);
const isGenerating = ref(false);
const generatedInvite = ref<GeneratedInvite | null>(null);
const qrCanvas = ref<HTMLCanvasElement | null>(null);
const users = ref<User[]>([]);

onMounted(() => {
  loadUsers();
});

async function generateInvite() {
  isGenerating.value = true;
  
  try {
    const response = await apiRequest('/invite/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: inviteRole.value,
        expiresInHours: inviteExpiryHours.value,
      }),
    });

    const data = await response.json();
    
    generatedInvite.value = {
      ...data,
      role: inviteRole.value,
    };

    // Генерируем QR-код
    await generateQRCode(data.inviteUrl);
    
  } catch (error) {
    console.error('Failed to generate invite:', error);
    alert('Ошибка при создании invite');
  } finally {
    isGenerating.value = false;
  }
}

async function generateQRCode(url: string) {
  if (!qrCanvas.value) return;
  
  try {
    await QRCode.toCanvas(qrCanvas.value, url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#4F46E5',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
  }
}

async function downloadQRCode() {
  if (!qrCanvas.value) return;
  
  const link = document.createElement('a');
  link.download = `invite-qr-${Date.now()}.png`;
  link.href = qrCanvas.value.toDataURL();
  link.click();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Скопировано в буфер обмена!');
  });
}

async function loadUsers() {
  try {
    const response = await apiRequest('/users', {
      method: 'GET',
    });
    
    const data = await response.json();
    users.value = data.users || [];
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

async function toggleUserStatus(user: User) {
  try {
    await apiRequest('/user/toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        active: !user.active,
      }),
    });
    
    // Обновить локально
    user.active = !user.active;
  } catch (error) {
    console.error('Failed to toggle user status:', error);
    alert('Ошибка при изменении статуса пользователя');
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
