// src/components/LogoutConfirmModal.vue

<template>
  <!-- Logout Confirm Modal -->
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
            <font-awesome-icon :icon="['fas', 'door-open']" class="me-2" />
            Abmelden
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
          <p>Möchten Sie sich wirklich abmelden?</p>

          <div class="form-check">
            <input
                id="eraseLocalData"
                v-model="eraseLocalData"
                class="form-check-input"
                type="checkbox"
            />
            <label for="eraseLocalData" class="form-check-label">
              Auch lokale Daten von diesem Gerät löschen
            </label>
          </div>
          <div class="form-text">
            Danach ist für die erneute Anmeldung auf diesem Gerät wieder eine
            neue Registrierung/Einladung erforderlich.
          </div>

          <!-- Buttons -->
          <div class="d-flex gap-2 mt-4">
            <button
                type="button"
                class="btn btn-secondary flex-fill"
                @click="closeModal"
            >
              Abbrechen
            </button>
            <button
                type="button"
                class="btn btn-primary flex-fill"
                @click="handleConfirm"
            >
              🚪 Abmelden
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    required: true
  }
})

// Emits
const emit = defineEmits(['close', 'confirm'])

// Local state
const eraseLocalData = ref(false)

/**
 * Confirm logout
 */
function handleConfirm() {
  emit('confirm', eraseLocalData.value)
  eraseLocalData.value = false
}

/**
 * Close modal
 */
function closeModal() {
  eraseLocalData.value = false
  emit('close')
}
</script>

<style scoped>
.modal {
  pointer-events: auto;
}

.modal-dialog {
  max-width: 400px;
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
