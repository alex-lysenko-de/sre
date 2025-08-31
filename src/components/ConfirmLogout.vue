<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { eventBus } from '../eventBus.js'
import { logoutLogic } from '../utils/utils.js'

const router = useRouter()
const showDialog = ref(false)

function requestLogout() {
  showDialog.value = true
}

async function onConfirm() {
  showDialog.value = false
  await logoutLogic()
  router.push('/welcome')
}

function onCancel() {
  showDialog.value = false
}

onMounted(() => {
  eventBus.on('open-logout-dialog', requestLogout)
})

onUnmounted(() => {
  eventBus.off('open-logout-dialog', requestLogout)
})
</script>

<template>
  <!-- Модалка -->
  <div
      v-if="showDialog"
      class="fixed inset-0 flex items-start justify-center bg-black bg-opacity-50 z-50"
  >
    <div
        class="bg-white rounded-2xl shadow-xl p-6 w-11/12 max-w-sm mt-20 text-center"
    >
      <h2 class="text-lg font-semibold mb-3">Bestätigung</h2>
      <p class="text-gray-700 mb-5">
        Möchten Sie sich wirklich abmelden?
      </p>
      <div class="flex justify-center gap-4">
        <button
            class="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400"
            @click="onCancel"
        >
          Nein
        </button>
        <button
            class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            @click="onConfirm"
        >
          Ja
        </button>
      </div>
    </div>
  </div>
</template>
