<template>
  <!-- Bus Change Modal -->
  <div
      v-if="show"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0,0,0,0.5);"
      @click.self="closeModal"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <!-- Header -->
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">
            <font-awesome-icon :icon="['fas', 'bus']" class="me-2" />
            Bus ändern
          </h5>
          <button
              type="button"
              class="btn-close btn-close-white"
              @click="closeModal"
              aria-label="Schließen"
          ></button>
        </div>

        <!-- Body -->
        <div class="modal-body p-4">
          <!-- Error Alert -->
          <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
            {{ error }}
            <button type="button" class="btn-close" @click="error = null"></button>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSave">
            <div class="mb-4">
              <label for="newBus" class="form-label fw-semibold">
                Neuer Bus
                <span class="text-danger">*</span>
              </label>
              <select
                  id="newBus"
                  v-model.number="selectedBus"
                  class="form-select form-select-lg"
                  required
                  :disabled="loading"
              >
                <option :value="null" disabled>Wählen Sie einen Bus</option>
                <option
                    v-for="n in totalBuses"
                    :key="n"
                    :value="n"
                >
                  Bus {{ n }}
                </option>
              </select>
              <div class="form-text">
                Aktueller Bus: <strong>{{ currentBus || 'Keine' }}</strong>
              </div>
            </div>

            <!-- Buttons -->
            <div class="d-flex gap-2">
              <button
                  type="button"
                  class="btn btn-secondary flex-fill"
                  @click="closeModal"
                  :disabled="loading"
              >
                Abbrechen
              </button>
              <button
                  type="submit"
                  class="btn btn-primary flex-fill"
                  :disabled="!isFormValid || loading"
              >
                <span v-if="loading">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Wird gespeichert...
                </span>
                <span v-else>
                  <font-awesome-icon :icon="['fas', 'save']" class="me-2" />
                  Speichern
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  currentBus: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['close', 'saved'])

// Stores
const userStore = useUserStore()
const configStore = useConfigStore()

// Get reactive config
const { config } = storeToRefs(configStore)

// Local state
const selectedBus = ref(props.currentBus)
const loading = ref(false)
const error = ref(null)

// Computed
const totalBuses = computed(() => parseInt(config.value.total_buses) || 5)

const isFormValid = computed(() =>
    selectedBus.value !== null && selectedBus.value !== props.currentBus
)

// Watch for prop changes
watch(() => props.currentBus, (newVal) => {
  selectedBus.value = newVal
})

/**
 * Handle form submission
 */
async function handleSave() {
  if (!isFormValid.value || loading.value) return

  loading.value = true
  error.value = null

  try {
    await userStore.assignUserToBus(selectedBus.value)
    console.log(`✅ Bus geändert auf: ${selectedBus.value}`)

    emit('saved', selectedBus.value)
    closeModal()
  } catch (err) {
    console.error('❌ Fehler beim Ändern des Buses:', err)
    error.value = `Fehler beim Speichern: ${err.message}`
  } finally {
    loading.value = false
  }
}

/**
 * Close modal
 */
function closeModal() {
  if (!loading.value) {
    emit('close')
  }
}
</script>

<style scoped>
.modal {
  pointer-events: auto;
}

.modal-dialog {
  max-width: 400px;
}

.form-select:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.modal-content {
  border-radius: 0.75rem;
}

.modal-header {
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
}

@media (max-width: 576px) {
  .modal-dialog {
    margin: 0.5rem;
  }
}
</style>