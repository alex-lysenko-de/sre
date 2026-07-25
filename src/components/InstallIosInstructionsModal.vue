// src/components/InstallIosInstructionsModal.vue

<template>
  <div
      v-if="installPromptStore.showIosInstructions"
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
            <font-awesome-icon :icon="['fas', 'arrow-right']" class="me-2" />
            App installieren
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
          <ol>
            <li>Tippen Sie auf <strong>Teilen</strong> (⬆️)</li>
            <li>Wählen Sie <strong>Zum Home-Bildschirm</strong></li>
            <li>Tippen Sie auf <strong>Hinzufügen</strong></li>
          </ol>

          <div class="d-grid mt-4">
            <button
                type="button"
                class="btn btn-primary"
                @click="closeModal"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useInstallPromptStore } from '@/stores/installPrompt'

const installPromptStore = useInstallPromptStore()

function closeModal() {
  installPromptStore.closeIosInstructions()
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
