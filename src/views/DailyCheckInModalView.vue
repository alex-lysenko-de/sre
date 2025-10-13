<template>
  <!-- Fullscreen blocking modal -->
  <div
      v-if="show"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0,0,0,0.8);"
      @click.self.prevent
      @keydown.esc.prevent
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <!-- Header -->
        <div class="modal-header bg-success text-white border-0">
          <h5 class="modal-title w-100 text-center fw-bold">
            <font-awesome-icon :icon="['fas', 'calendar-check']" class="me-2" />
            {{ formattedDate }}
          </h5>
          <!-- No close button - modal is blocking! -->
        </div>

        <!-- Body -->
        <div class="modal-body p-4">
          <!-- Alert container -->
          <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
            {{ error }}
            <button type="button" class="btn-close" @click="error = null"></button>
          </div>

          <!-- Info message if pre-filled -->
          <div v-if="isPreFilled" class="alert alert-info" role="alert">
            <font-awesome-icon :icon="['fas', 'info-circle']" class="me-2" />
            Ihre Gruppe und Bus wurden bereits zugewiesen. Bitte bestätigen Sie Ihre Anwesenheit.
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit">
            <!-- Group Selection -->
            <div class="mb-4">
              <label for="groupSelect" class="form-label fw-semibold">
                <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
                Gruppe
                <span class="text-danger">*</span>
              </label>
              <select
                  id="groupSelect"
                  v-model.number="selectedGroup"
                  class="form-select form-select-lg"
                  required
                  :disabled="loading"
              >
                <option :value="null" disabled>Wählen Sie eine Gruppe</option>
                <option
                    v-for="n in totalGroups"
                    :key="n"
                    :value="n"
                >
                  Gruppe {{ n }}
                </option>
              </select>
            </div>

            <!-- Bus Selection -->
            <div class="mb-4">
              <label for="busSelect" class="form-label fw-semibold">
                <font-awesome-icon :icon="['fas', 'bus']" class="me-2" />
                Bus
                <span class="text-danger">*</span>
              </label>
              <select
                  id="busSelect"
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
            </div>

            <!-- Submit Button -->
            <button
                type="submit"
                class="btn btn-success btn-lg w-100 fw-bold"
                :disabled="!isFormValid || loading"
            >
              <span v-if="loading">
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Wird gespeichert...
              </span>
              <span v-else>
                <font-awesome-icon :icon="['fas', 'check-circle']" class="me-2" />
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
import { ref, computed, watch, onMounted } from 'vue'
import { useUser } from '@/composables/useUser'
import { useConfig } from '@/modules/config'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    required: true,
    default: false
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
const loading = ref(false)
const error = ref(null)

// Computed properties
const totalGroups = computed(() => parseInt(config.value.total_groups) || 15)
const totalBuses = computed(() => parseInt(config.value.total_buses) || 5)

const formattedDate = computed(() => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  return new Date().toLocaleDateString('de-DE', options)
})

const isFormValid = computed(() =>
    selectedGroup.value !== null && selectedBus.value !== null
)

const isPreFilled = computed(() =>
    userInfo.value.group_id !== null || userInfo.value.bus_id !== null
)

// Watch for userInfo changes to pre-fill form
watch(() => userInfo.value, (newVal) => {
  if (newVal.group_id) {
    selectedGroup.value = newVal.group_id
  }
  if (newVal.bus_id) {
    selectedBus.value = newVal.bus_id
  }
}, { immediate: true })

// Form submission handler
async function handleSubmit() {
  if (!isFormValid.value || loading.value) return

  loading.value = true
  error.value = null

  try {
    // Assign group
    await assignUserToGroup(selectedGroup.value)
    console.log(`✅ Assigned to group ${selectedGroup.value}`)

    // Assign bus
    await assignUserToBus(selectedBus.value)
    console.log(`✅ Assigned to bus ${selectedBus.value}`)

    // Mark as present
    await updateUserPresence(1)
    console.log('✅ Marked as present')

    // Emit completion event
    emit('completed', {
      group_id: selectedGroup.value,
      bus_id: selectedBus.value
    })

  } catch (err) {
    console.error('❌ Error during check-in:', err)
    error.value = `Fehler beim Speichern: ${err.message}`
    emit('error', err)
  } finally {
    loading.value = false
  }
}

// Prevent modal close on backdrop click
onMounted(() => {
  // Disable Bootstrap modal auto-close behavior
  document.addEventListener('keydown', preventEscape)
})

function preventEscape(e) {
  if (e.key === 'Escape' && props.show) {
    e.preventDefault()
    e.stopPropagation()
  }
}
</script>

<style scoped>
/* Ensure modal is truly blocking */
.modal {
  pointer-events: auto;
}

.modal-dialog {
  max-width: 500px;
}

.form-select:focus,
.btn:focus {
  box-shadow: 0 0 0 0.25rem rgba(25, 135, 84, 0.25);
}

/* Prevent user from closing modal */
.modal-content {
  border-radius: 1rem;
}

.modal-header {
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
}

/* Mobile responsive */
@media (max-width: 576px) {
  .modal-dialog {
    margin: 0.5rem;
  }
}
</style>