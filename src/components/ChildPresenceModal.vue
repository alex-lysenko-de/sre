<!-- src/components/ChildPresenceModal.vue -->
<template>
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
        <div class="modal-header bg-success text-white">
          <h5 class="modal-title">
            <i class="fas fa-clipboard-check me-2"></i>
            Präsenz registrieren
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
            <i class="fas fa-exclamation-triangle me-2"></i>
            {{ error }}
            <button type="button" class="btn-close" @click="error = null"></button>
          </div>

          <!-- Child Info -->
          <div class="mb-3">
            <p class="mb-3">
              <strong>{{ childName }}</strong> wird als anwesend markiert.
            </p>

            <!-- Bus ID hinzufügen Checkbox -->
            <div class="form-check mb-3">
              <input
                  class="form-check-input"
                  type="checkbox"
                  v-model="localIncludeBusId"
                  id="includeBusCheckbox"
                  :disabled="loading"
              >
              <label class="form-check-label" for="includeBusCheckbox">
                <i class="fas fa-bus me-1"></i>
                Bus-Nummer hinzufügen
              </label>
            </div>

            <!-- Bus Auswahl -->
            <div v-if="localIncludeBusId" class="mb-3">
              <label for="busSelect" class="form-label">
                <i class="fas fa-bus me-1"></i>
                Bus-Nummer
              </label>
              <select
                  class="form-select"
                  id="busSelect"
                  v-model.number="localSelectedBusId"
                  :disabled="loading"
              >
                <option :value="null">Kein Bus</option>
                <option v-for="n in totalBuses" :key="n" :value="n">
                  Bus #{{ n }}
                </option>
              </select>
            </div>

            <!-- Info Text -->
            <div class="alert alert-info small mb-0">
              <i class="fas fa-info-circle me-1"></i>
              {{ infoText }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
              type="button"
              class="btn btn-secondary"
              @click="closeModal"
              :disabled="loading"
          >
            Abbrechen
          </button>
          <button
              type="button"
              class="btn btn-success"
              @click="handleConfirm"
              :disabled="loading"
          >
            <span v-if="!loading">
              <i class="fas fa-check me-1"></i>
              Bestätigen
            </span>
            <span v-else>
              <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Wird registriert...
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '@/stores/config'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  childName: {
    type: String,
    required: true
  },
  isFirstCheckToday: {
    type: Boolean,
    default: true
  },
  currentBusId: {
    type: Number,
    default: null
  },
  defaultBusId: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['close', 'confirm'])

// Store
const configStore = useConfigStore()

// Local state
const localIncludeBusId = ref(false)
const localSelectedBusId = ref(null)
const loading = ref(false)
const error = ref(null)

// Computed
const totalBuses = computed(() => configStore.totalBuses || 10)

const infoText = computed(() => {
  if (props.isFirstCheckToday) {
    return 'Erste Anwesenheitsprüfung heute - Kind steigt gerade in den Bus.'
  } else if (props.currentBusId) {
    return `Kind ist bereits in Bus #${props.currentBusId} registriert. Nur ändern, wenn Kind den Bus gewechselt hat.`
  } else {
    return 'Kind ist bereits anwesend. Bus-Nummer bei Bedarf hinzufügen oder aktualisieren.'
  }
})

// Watch for show changes to reset form
watch(() => props.show, (newVal) => {
  if (newVal) {
    initializeForm()
  }
})

/**
 * Initialize form with smart defaults
 * - Checkbox ON nur wenn это первая запись за день (первый check-in)
 * - Pre-fill bus с defaultBusId пользователя
 */
function initializeForm() {
  error.value = null
  loading.value = false

  // Логика: галочка включена ТОЛЬКО при первом check-in за день
  // Если это первая запись и нет информации об автобусе - ребенок только садится в автобус
  // Если это не первая запись - скорее всего сканируется в другом месте, автобус не нужен
  localIncludeBusId.value = props.isFirstCheckToday || !props.currentBusId

  // Pre-fill с автобусом пользователя (машинист едит в том же автобусе)
  localSelectedBusId.value = props.defaultBusId || null

  console.log(`🎯 Modal initialized: includeBus=${localIncludeBusId.value}, busId=${localSelectedBusId.value}, isFirst=${props.isFirstCheckToday}, currentBus=${props.currentBusId}`)
}

/**
 * Handle confirm button
 */
async function handleConfirm() {
  loading.value = true
  error.value = null

  try {
    const busIdToSave = localIncludeBusId.value ? localSelectedBusId.value : null

    emit('confirm', {
      busId: busIdToSave,
      includeBusId: localIncludeBusId.value
    })

    // Don't close here - let parent handle it after successful save
  } catch (err) {
    console.error('Error in modal:', err)
    error.value = err.message || 'Ein Fehler ist aufgetreten'
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

/**
 * Set loading state (called by parent after save attempt)
 */
function setLoading(state) {
  loading.value = state
}

/**
 * Set error (called by parent if save fails)
 */
function setError(message) {
  error.value = message
  loading.value = false
}

// Expose methods to parent
defineExpose({
  setLoading,
  setError
})
</script>

<style scoped>
.modal {
  pointer-events: auto;
}

.modal-content {
  border-radius: 0.75rem;
}

.modal-header {
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
}

.form-check-input:checked {
  background-color: #198754;
  border-color: #198754;
}

.form-select:focus {
  border-color: #198754;
  box-shadow: 0 0 0 0.25rem rgba(25, 135, 84, 0.25);
}

@media (max-width: 576px) {
  .modal-dialog {
    margin: 0.5rem;
  }
}
</style>