<template>
  <div class="p-6 max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-green-700">⚙️ Konfigurationsverwaltung</h1>

    <div v-if="!isAdmin" class="text-red-600 font-semibold">
      Sie haben keine Rechte, auf diese Seite zuzugreifen.
    </div>

    <div v-else>
      <div v-if="loading">Einstellungen werden geladen...</div>
      <div v-else>
        <div v-for="(value, key) in config" :key="key" class="border-b py-3">
          <label class="block font-semibold text-gray-700">{{ key }}</label>
          <input
              v-model="localConfig[key]"
              class="border rounded px-2 py-1 w-full"
          />
          <button
              @click="saveConfig(key)"
              class="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            💾 Speichern
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useConfig } from '../modules/config'

const { config, loadConfig, updateConfig, isAdmin, initConfigModule, loading } = useConfig()
const localConfig = reactive({})

onMounted(async () => {
  await initConfigModule()
  await loadConfig()
  Object.assign(localConfig, config.value)
})

async function saveConfig(key) {
  await updateConfig(key, localConfig[key])
}
</script>