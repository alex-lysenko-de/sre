<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
    <div class="max-w-md w-full">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="mx-auto w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-3xl font-bold text-gray-900">Регистрация</h2>
          <p class="text-gray-600 mt-2">Создайте аккаунт с биометрией</p>
        </div>

        <!-- Error Alert -->
        <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <h3 class="text-sm font-medium text-red-800">Ошибка</h3>
              <p class="text-sm text-red-700 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleRegister" class="space-y-6">
          <!-- Display Name -->
          <div>
            <label for="displayName" class="block text-sm font-medium text-gray-700 mb-2">
              Ваше имя
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              required
              placeholder="Введите ваше имя"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              :disabled="isLoading"
            />
          </div>

          <!-- WebAuthn Info -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="flex-1">
                <h4 class="text-sm font-medium text-blue-900">Биометрическая защита</h4>
                <p class="text-sm text-blue-800 mt-1">
                  Для входа будет использоваться Face ID, Touch ID или пин-код вашего устройства
                </p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || !displayName"
            class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Уже есть аккаунт?
            <router-link to="/login" class="text-indigo-600 hover:text-indigo-700 font-medium">
              Войти
            </router-link>
          </p>
        </div>

        <!-- Invite Token Info -->
        <div v-if="inviteToken" class="mt-4 text-center">
          <p class="text-xs text-gray-500">
            Invite код обнаружен ✓
          </p>
        </div>
      </div>

      <!-- Device Support Check -->
      <div v-if="!isWebAuthnSupported" class="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p class="text-sm text-yellow-800 text-center">
          ⚠️ Ваше устройство не поддерживает биометрическую аутентификацию
        </p>
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
/* Дополнительные стили при необходимости */
</style>
