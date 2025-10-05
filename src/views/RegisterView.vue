<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-4 py-8">
    <div class="max-w-md w-full">
      <div class="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform hover:scale-105 transition-transform duration-300">
            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-4xl font-extrabold text-gray-900 mb-2">Регистрация</h2>
          <p class="text-gray-600 text-lg">Создайте аккаунт с биометрией</p>
        </div>

        <!-- Error Alert -->
        <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl shadow-sm animate-shake">
          <div class="flex items-start">
            <svg class="w-6 h-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <h3 class="text-sm font-bold text-red-800">Ошибка</h3>
              <p class="text-sm text-red-700 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleRegister" class="space-y-6">
          <!-- Display Name -->
          <div>
            <label for="displayName" class="block text-sm font-semibold text-gray-700 mb-2">
              Ваше имя
            </label>
            <div class="relative">
              <input
                  id="displayName"
                  v-model="displayName"
                  type="text"
                  required
                  placeholder="Введите ваше имя"
                  class="w-full px-4 py-4 pr-10 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 text-gray-900 placeholder-gray-400 hover:border-gray-300"
                  :disabled="isLoading"
              />
              <svg class="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

          <!-- WebAuthn Info -->
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 shadow-sm">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                </svg>
              </div>
              <div class="ml-4 flex-1">
                <h4 class="text-sm font-bold text-blue-900 mb-1">Биометрическая защита</h4>
                <p class="text-sm text-blue-800 leading-relaxed">
                  Для входа будет использоваться Face ID, Touch ID или пин-код вашего устройства
                </p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
              type="submit"
              :disabled="isLoading || !displayName"
              class="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span v-if="!isLoading">Зарегистрироваться</span>
            <span v-else>Регистрация...</span>
          </button>
        </form>

        <!-- Footer -->
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-600">
            Уже есть аккаунт?
            <router-link to="/login" class="text-indigo-600 hover:text-indigo-700 font-bold hover:underline transition-all">
              Войти
            </router-link>
          </p>
        </div>

        <!-- Invite Token Info -->
        <div v-if="inviteToken" class="mt-6 text-center">
          <div class="inline-flex items-center px-4 py-2 bg-green-50 border border-green-200 rounded-full">
            <svg class="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-xs font-semibold text-green-700">Invite код обнаружен</span>
          </div>
        </div>
      </div>

      <!-- Device Support Check -->
      <div v-if="!isWebAuthnSupported" class="mt-6 p-5 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-xl shadow-lg">
        <div class="flex items-center">
          <svg class="w-6 h-6 text-yellow-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <p class="text-sm font-semibold text-yellow-800">
            Ваше устройство не поддерживает биометрическую аутентификацию
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const { register, isLoading, error: authError } = useAuth();

const displayName = ref('');
const inviteToken = ref('');
const error = ref<string | null>(null);

const isWebAuthnSupported = computed(() => {
  return window.PublicKeyCredential !== undefined;
});

onMounted(() => {
  // Получить invite token из URL
  const token = route.query.invite as string;
  if (token) {
    inviteToken.value = token;
  } else {
    error.value = 'Invite токен не найден. Попросите администратора создать новый QR-код.';
  }

  // Проверить поддержку WebAuthn
  if (!isWebAuthnSupported.value) {
    error.value = 'Ваше устройство не поддерживает биометрическую аутентификацию.';
  }
});

async function handleRegister() {
  if (!inviteToken.value) {
    error.value = 'Отсутствует invite токен';
    return;
  }

  if (!displayName.value.trim()) {
    error.value = 'Пожалуйста, введите ваше имя';
    return;
  }

  error.value = null;

  try {
    await register(inviteToken.value, displayName.value.trim());

    // Успешная регистрация - перенаправление
    router.push('/dashboard');
  } catch (err: any) {
    error.value = err.message || 'Ошибка регистрации';
    console.error('Registration error:', err);
  }
}
</script>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
}
</style>