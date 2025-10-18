// src/components/DailyCheckInModalView.vue

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
        <div class="modal-header bg-success text-white border-0">
          <h5 class="modal-title w-100 text-center fw-bold">
            <font-awesome-icon :icon="['fas', 'calendar-check']" class="me-2" />
            {{ formattedDate }}
          </h5>
          <button type="button" class="btn-close btn-close-white" @click="closeModal" aria-label="Schließen"></button>
        </div>

        <div class="modal-body p-4">
          <form @submit.prevent="handleSubmit">
            <div class="mb-4">
              <label for="groupSelect" class="form-label fw-semibold">
                <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
                Gruppe (Optional)
              </label>
              <select
                  id="groupSelect"
                  v-model.number="selectedGroup"
                  class="form-select form-select-lg"
                  :disabled="loading"
              >
                <option :value="null">Keine Gruppe</option>
                <option
                    v-for="n in configStore.totalGroups"
                    :key="n"
                    :value="n"
                >
                  Gruppe {{ n }}
                </option>
              </select>
            </div>

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
                    v-for="n in configStore.totalBuses"
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
                Ok
              </span>
            </button>
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
    required: true,
    default: false
  }
})

// Emits
const emit = defineEmits(['completed', 'error', 'close'])

// Stores
const userStore = useUserStore()
const configStore = useConfigStore()

// Get reactive state from stores
const { userInfo } = storeToRefs(userStore)

// Local state
const selectedGroup = ref(null)
const selectedBus = ref(null)
const loading = ref(false)
const error = ref(null)

// Computed properties
const formattedDate = computed(() => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  return new Date().toLocaleDateString('de-DE', options)
})

const isFormValid = computed(() =>
    selectedBus.value !== null
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
    if (selectedGroup.value) {
      await userStore.assignUserToGroup(selectedGroup.value)
      console.log(`✅ Assigned to group ${selectedGroup.value}`)
    }
    // Assign bus
    await userStore.assignUserToBus(selectedBus.value)
    console.log(`✅ Assigned to bus ${selectedBus.value}`)

    // Mark as present
    await userStore.updateUserPresence(1)
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

function closeModal() {
  if (!loading.value) {
    emit('close')
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