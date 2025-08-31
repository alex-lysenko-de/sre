<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 px-4">
    <div class="max-w-md w-full">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="mx-auto w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 class="text-3xl font-bold text-gray-900">Вход</h2>
          <p class="text-gray-600 mt-2">Войдите с помощью биометрии</p>
        </div>

        <!-- Success Message -->
        <div v-if="showSuccessMessage" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <p class="text-sm text-green-800">Вы успешно зарегистрированы! Теперь войдите в систему.</p>
            </div>
          </div>
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

        <!-- Login Button -->
        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span v-if="!isLoading">Войти с биометрией</span>
          <span v-else>Вход...</span>
        </button>

        <!-- Info Box -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <h4 class="text-sm font-medium text-blue-900">Как это работает</h4>
              <ul class="mt-2 text-sm text-blue-800 space-y-1">
                <li>• Нажмите кнопку входа</li>
                <li>• Подтвердите вход через Face ID / Touch ID</li>
                <li>• Готово! Вы в системе</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Нет аккаунта?
            <span class="text-gray-800 font-medium">Попросите QR-код у администратора</span>
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
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const route = useRoute();
const { login, isLoading, error: authError, isAuthenticated } = useAuth();

const error = ref<string | null>(null);
const showSuccessMessage = ref(false);

const isWebAuthnSupported = computed(() => {
  return window.PublicKeyCredential !== undefined;
});

onMounted(() => {
  // Показать сообщение об успешной регистрации
  if (route.query.registered === 'true') {
    showSuccessMessage.value = true;
    setTimeout(() => {
      showSuccessMessage.value = false;
    }, 5000);
  }

  // Если уже авторизован, перенаправить
  if (isAuthenticated.value) {
    router.push('/dashboard');
  }

  // Проверить поддержку WebAuthn
  if (!isWebAuthnSupported.value) {
    error.value = 'Ваше устройство не поддерживает биометрическую аутентификацию.';
  }
});

async function handleLogin() {
  error.value = null;

  try {
    await login();
    
    // Успешный вход - перенаправление
    router.push('/dashboard');
  } catch (err: any) {
    if (err.message.includes('not found') || err.message.includes('NotAllowedError')) {
      error.value = 'Устройство не зарегистрировано. Попросите QR-код для регистрации.';
    } else {
      error.value = err.message || 'Ошибка входа';
    }
    console.error('Login error:', err);
  }
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
