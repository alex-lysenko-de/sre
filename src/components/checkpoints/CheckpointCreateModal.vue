<!-- src/components/checkpoints/CheckpointCreateModal.vue -->
<!-- Typauswahl fuer die explizite Erstellung einer Checkpoint durch den
     Administrator. Zeigt bereits offene Typen als blockiert an
     (tickets/130/decision.md, Punkt 4). Ported from the 130_2 prototype -
     real useCheckpoints.js instead of the mock, DebugTag removed (was only
     for UX alignment, not production). -->
<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-backdrop" @click.self="close">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Neuen Checkpoint erstellen</h5>
              <button type="button" class="btn-close" @click="close"></button>
            </div>

            <div class="modal-body">
              <div class="d-grid gap-3 cp-type-buttons">
                <button
                    v-for="option in typeOptions"
                    :key="option.type"
                    type="button"
                    class="btn cp-type-btn d-flex justify-content-between align-items-center"
                    :class="option.btnClass"
                    :disabled="openTypes.includes(option.type)"
                    @click="choose(option.type)"
                >
                  <span>
                    <font-awesome-icon :icon="option.icon" class="me-2" />
                    {{ option.label }}
                  </span>
                  <span v-if="openTypes.includes(option.type)" class="badge bg-danger">
                    Bereits offen
                  </span>
                </button>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="close">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { CHECKPOINT_TYPE } from '@/composables/useCheckpoints'

defineProps({
  show: {
    type: Boolean,
    required: true
  },
  openTypes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'create'])

const typeOptions = [
  { type: CHECKPOINT_TYPE.BUS, label: 'Bus', icon: ['fas', 'bus'], btnClass: 'btn-primary' },
  { type: CHECKPOINT_TYPE.GROUP, label: 'Group', icon: ['fas', 'users'], btnClass: 'btn-info text-dark' },
  { type: CHECKPOINT_TYPE.LAZY, label: 'Lazy', icon: ['fas', 'clipboard-check'], btnClass: 'btn-secondary' }
]

function choose(type) {
  emit('create', type)
}

function close() {
  emit('close')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
}

.modal-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-width: 480px;
  width: 90%;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem;
}

.cp-type-btn {
  min-height: 64px;
  font-size: 1.2rem;
  font-weight: 700;
  padding: 16px 20px;
  border-radius: 12px;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.modal-footer .btn {
  min-height: 52px;
  font-size: 1.1rem;
  padding: 12px 20px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
