<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-success text-white">
          <h5 class="modal-title">
            <font-awesome-icon :icon="['fas', 'calendar-alt']" class="me-2" />
            {{ formattedDate }}
          </h5>
        </div>

        <div class="modal-body p-4">
          <!-- Alert Container -->
          <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
            {{ errorMessage }}
            <button type="button" class="btn-close" @click="errorMessage = ''"></button>
          </div>

          <form @submit.prevent="handleSubmit">
            <!-- Group Selection -->
            <div class="mb-4">
              <label for="groupSelect" class="form-label fw-semibold">
                <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
                Gruppe <span class="text-danger">*</span>
              </label>
              <select
                  id="groupSelect"
                  v-model.number="selectedGroup"
                  class="form-select form-select-lg"
                  required
              >
                <option :value="null" disabled>Bitte wählen...</option>
                <option v-for="n in totalGroups" :key="n" :value="n">
                  Gruppe {{ n }}
                </option>
              </select>
            </div>

            <!-- Bus Selection -->
            <div class="mb-4">
              <label for="busSelect" class="form-label fw-semibold">
                <font-awesome-icon :icon="['fas', 'bus']" class="me-2" />
                Bus <span class="text-danger">*</span>
              </label>
              <select
                  id="busSelect"
                  v-model.number="selectedBus"
                  class="form-select form-select-lg"
                  required
              >
                <option :value="null" disabled>Bitte wählen...</option>
                <option v-for="n in totalBuses" :key="n" :value="n">
                  Bus {{ n }}
                </option>
              </select>
            </div>

            <!-- Submit Button -->
            <button
                type="submit"
                class="btn btn-success btn-lg w-100 fw-semibold"
                :disabled="!selectedGroup || !selectedBus || submitting"
            >
              <span v-if="submitting">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Wird gespeichert...
              </span>
              <span v-else>
                <font-awesome-icon :icon="['fas', 'check']" class="me-2" />
                Ich fahre heute mit!
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useUser } from '@/composables/useUser'
import { useConfig } from '@/modules/config'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    required: true
  }
})

// Emits
const emit = defineEmits(['completed', 'error'])

// Composables
const { userInfo, assignUserToGroup, assignUserToBus, updateUserPresence } = useUser()
const { config } = useConfig()

// Local state
const selectedGroup = ref(null)
const selectedBus = ref(null)
const submitting = ref(false)
const errorMessage = ref('')

// Computed
const totalGroups = computed(() => parseInt(config.value.total_groups) || 15)
const totalBuses = computed(() => parseInt(config.value.total_buses) || 5)

const formattedDate = computed(() => {
  const date = new Date()
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
})

// Watch for pre-filled values when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    // Pre-fill with existing values if available
    selectedGroup.value = userInfo.value.group_id || null
    selectedBus.value = userInfo.value.bus_id || null
    errorMessage.value = ''
  }
})

// Form submission handler
async function handleSubmit() {
  if (!selectedGroup.value || !selectedBus.value) {
    errorMessage.value = 'Bitte wählen Sie sowohl Gruppe als auch Bus aus.'
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    // Step 1: Assign to group
    await assignUserToGroup(selectedGroup.value)

    // Step 2: Assign to bus
    await assignUserToBus(selectedBus.value)

    // Step 3: Mark as present
    await updateUserPresence(true)

    // Success - emit event to close modal
    emit('completed')
  } catch (err) {
    console.error('Error during check-in:', err)
    errorMessage.value = `Fehler beim Speichern: ${err.message}`
    emit('error', err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  // Pre-fill values if already set
  if (props.show) {
    selectedGroup.value = userInfo.value.group_id || null
    selectedBus.value = userInfo.value.bus_id || null
  }
})
</script>

<style scoped>
/* Modal overlay that blocks all interaction */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-dialog {
  width: 100%;
  max-width: 500px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  border-bottom: none;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.modal-body {
  padding: 2rem 1.5rem;
}

/* Prevent body scroll when modal is open */
body:has(.modal-overlay) {
  overflow: hidden;
}

/* Make form elements larger and more touch-friendly */
.form-select-lg {
  font-size: 1.1rem;
  padding: 0.75rem 1rem;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
}

/* Animation */
.modal-overlay {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  animation: slideUp 0.3s ease-in-out;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>