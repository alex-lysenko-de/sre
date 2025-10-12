<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'cogs']" />
          Konfigurationsverwaltung
        </h3>
      </div>

      <div class="card-body">
        <div v-if="!isAdmin" class="alert alert-danger" role="alert">
          <font-awesome-icon :icon="['fas', 'lock']" class="me-2" />
          Sie haben keine Rechte, auf diese Seite zuzugreifen.
        </div>

        <div v-else>
          <div v-if="loading" class="text-center py-4">
            <div class="spinner-border mb-2" role="status">
              <span class="visually-hidden">Wird geladen...</span>
            </div>
            <p class="text-muted">Einstellungen werden geladen...</p>
          </div>
          <div v-else>
            <div v-for="(value, key) in config" :key="key" class="border-bottom py-3">
              <label :for="'config-key-' + key" class="form-label fw-semibold text-dark">{{ key }}</label>
              <div class="input-group">
                <input
                    :id="'config-key-' + key"
                    type="text"
                    v-model="localConfig[key]"
                    class="form-control"
                    aria-label="Konfigurationswert"
                />
                <button
                    @click="saveConfig(key)"
                    class="btn btn-success"
                    type="button"
                >
                  <font-awesome-icon :icon="['fas', 'save']" />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useConfig } from '../modules/config'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome' // Assuming FontAwesome is available

// Destructure reactive state and functions from the composable
const { config, loadConfig, updateConfig, isAdmin, initConfigModule, loading } = useConfig()

// Local state for form inputs, reactive to handle updates
const localConfig = reactive({})

// Lifecycle hook: initialize module, load config, and sync local state
onMounted(async () => {
  // Initialize the configuration module
  await initConfigModule()
  // Load the configuration data from the backend
  await loadConfig()
  // Deep copy the config values to the local form state
  Object.assign(localConfig, config.value)
})

/**
 * Saves a specific configuration key-value pair.
 * @param {string} key - The configuration key to update.
 */
async function saveConfig(key) {
  // Call the composable function to update the config in the backend
  await updateConfig(key, localConfig[key])
  // Optional: Add a local alert/toast notification here if needed,
  // but for simplicity, we rely on the logic inside useConfig.
}
</script>

<style>
.main-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa;
}

.card {
  width: 100%;
  max-width: 650px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card-header {
  background-color: #007bff;
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}

.btn-success {
  background-color: #198754; /* Standard Bootstrap success green */
  border-color: #198754;
}

.btn-success:hover {
  background-color: #157347;
  border-color: #146c43;
}
</style>