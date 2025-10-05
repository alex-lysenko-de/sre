<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
    <div class="bg-white shadow-lg rounded-2xl p-8 w-full max-w-sm">
      <div class="flex flex-col items-center mb-6">
        <UserIcon class="w-12 h-12 text-indigo-600 mb-2" />
        <h1 class="text-2xl font-semibold text-gray-800">Регистрация</h1>
        <p class="text-gray-500 text-sm text-center mt-1">
          Создайте учётную запись через WebAuthn
        </p>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Ваше имя
          </label>
          <input
              v-model="displayName"
              type="text"
              required
              placeholder="Иван Иванов"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Инвайт-токен
          </label>
          <div class="flex items-center gap-2">
            <KeyRoundIcon class="w-5 h-5 text-gray-400" />
            <input
                v-model="inviteToken"
                type="text"
                required
                placeholder="Введите токен"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
            type="submit"
            :disabled="isLoading"
            class="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
        >
          <Loader2Icon
              v-if="isLoading"
              class="w-5 h-5 animate-spin text-white"
          />
          <span>{{ isLoading ? 'Регистрация...' : 'Зарегистрироваться' }}</span>
        </button>

        <p v-if="error" class="text-red-600 text-sm text-center mt-2">
          {{ error }}
        </p>

        <p v-if="success" class="text-green-600 text-sm text-center mt-2">
          Регистрация успешна! 🎉
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { UserIcon, KeyRoundIcon, Loader2Icon } from 'lucide-vue-next'

const displayName = ref('')
const inviteToken = ref('')
const success = ref(false)

const { register, initialize, isLoading, error } = useAuth()

onMounted(() => {
  initialize() // загрузим user/token из storage, если есть
})

async function handleRegister() {
  try {
    success.value = false
    await register(inviteToken.value.trim(), displayName.value.trim())
    success.value = true
  } catch (e) {
    console.error(e)
  }
}
</script>
