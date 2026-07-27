<!-- src/components/checkpoints-prototype/CheckpointCreateModal.vue -->
<!-- Typauswahl fuer die explizite Erstellung einer Checkpoint durch den
     Administrator. Zeigt bereits offene Typen als blockiert an (decision.md,
     Punkt 4: zweite offene Checkpoint desselben Typs wird durch das
     Interface verhindert) - rein anzeigend, die eigentliche Entscheidung
     (createCheckpoint()) trifft die aufrufende View. -->
<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-backdrop" @click.self="close">
        <div class="modal-dialog">
          <div class="modal-content">
            <DebugTag variant="page" label="Page 5" />

            <div class="modal-header">
              <DebugTag label="el1" />
              <h5 class="modal-title">Neuen Checkpoint erstellen</h5>
              <button type="button" class="btn-close" @click="close"></button>
            </div>

            <div class="modal-body">
              <DebugTag label="el2" />
              <div class="d-grid gap-2">
                <button
                    v-for="option in typeOptions"
                    :key="option.type"
                    type="button"
                    class="btn btn-outline-primary d-flex justify-content-between align-items-center"
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
              <DebugTag label="el3" />
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
import { CHECKPOINT_TYPE } from '@/composables/useCheckpointsMock'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

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
  { type: CHECKPOINT_TYPE.BUS, label: 'Bus', icon: ['fas', 'bus'] },
  { type: CHECKPOINT_TYPE.GROUP, label: 'Group', icon: ['fas', 'users'] },
  { type: CHECKPOINT_TYPE.LAZY, label: 'Lazy', icon: ['fas', 'clipboard-check'] }
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

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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
