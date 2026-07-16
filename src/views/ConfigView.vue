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
        <div v-if="!roleChecked" class="text-center py-4">
          <div class="spinner-border mb-2" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Berechtigungen werden geprüft...</p>
        </div>

        <div v-else-if="!userStore.isAdmin" class="alert alert-danger" role="alert">
          <font-awesome-icon :icon="['fas', 'lock']" class="me-2" />
          Sie haben keine Rechte, auf diese Seite zuzugreifen.
        </div>

        <div v-else>
          <div v-if="configStore.loading" class="text-center py-4">
            <div class="spinner-border mb-2" role="status">
              <span class="visually-hidden">Wird geladen...</span>
            </div>
            <p class="text-muted">Einstellungen werden geladen...</p>
          </div>
          <div v-else>
            <div v-for="(value, key) in configStore.config" :key="key" class="border-bottom py-3">
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
import { reactive, onMounted, ref, watch } from 'vue'
import { useConfigStore } from '../stores/config'
import { useUserStore } from '../stores/user'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// Destructure reactive state and functions from the composable
const configStore = useConfigStore()
const userStore = useUserStore()

// Local state for form inputs, reactive to handle updates
const localConfig = reactive({})

// True once userStore.userInfo.role is known (loaded or confirmed absent).
// Prevents a "keine Rechte" flash while userStore.loadUser() is still
// resolving after the router guard already let an admin through.
const roleChecked = ref(false)

// Lifecycle hook: initialize module, load config, and sync local state
onMounted(async () => {
  // Load configuration on mount
  Object.assign(localConfig, configStore.config)

  if (userStore.userInfo.role !== null) {
    roleChecked.value = true
  } else if (!userStore.loading) {
    await userStore.loadUser()
    roleChecked.value = true
  } else {
    // A load triggered elsewhere (e.g. App.vue) is already in flight —
    // wait for it instead of starting a redundant one (loadUser() is a no-op while loading).
    const stopWatch = watch(
        () => userStore.loading,
        (loading) => {
          if (!loading) {
            stopWatch()
            roleChecked.value = true
          }
        }
    )
  }
})

/**
 * Saves a specific configuration key-value pair.
 * @param {string} key - The configuration key to update.
 */
async function saveConfig(key) {
  if (!userStore.isAdmin) {
    alert('⛔ Sie haben keine Rechte, um die Konfiguration zu speichern.')
    return
  }

  try {
    await configStore.updateConfig(key, localConfig[key])
  } catch (err) {
    console.error('Fehler beim Speichern der Konfiguration:', err)
    alert('❌ Fehler beim Speichern: ' + (err.message || 'Unbekannter Fehler'))
  }
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
  background-color: #198754;
  border-color: #198754;
}

.btn-success:hover {
  background-color: #157347;
  border-color: #146c43;
}
</style>