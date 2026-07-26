<!-- src/components/GroupDetailModal.vue -->
<!-- Analog zu BusDetailModal.vue (Ticket 122) - zeigt die für eine Gruppe
     empfangenen Scan-Pakete (autor, Zeit, Kinderzahl). Ersetzt keinen
     bestehenden Bildschirm - vor diesem Ticket gab es kein Detail-Fenster
     für Gruppen (nur /group-edit/:id in ChildrenView.vue). -->
<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-backdrop" @click.self="close">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <!-- Header -->
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-users me-2"></i>
                Gruppe {{ groupId }} - Empfangene Pakete
              </h5>
              <button type="button" class="btn-close" @click="close"></button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              <div v-if="loading" class="text-center py-5">
                <div class="spinner-border mb-3"></div>
                <p class="text-muted">Lade Pakete...</p>
              </div>

              <div v-else>
                <div v-if="packets.length" class="list-group">
                  <div
                      v-for="packet in packets"
                      :key="packet.id"
                      class="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <strong>{{ packet.authorName }}</strong>
                      <span class="text-muted ms-2">{{ formatReceivedAt(packet.receivedAt) }}</span>
                    </div>
                    <span class="badge bg-primary">{{ packet.childrenCount }} Kinder</span>
                  </div>
                </div>
                <div v-else class="text-center py-5">
                  <i class="fas fa-info-circle fa-3x text-muted mb-3"></i>
                  <h5 class="text-muted">Keine Pakete für diese Gruppe</h5>
                  <p class="text-muted">Heute wurde noch kein Paket für diese Gruppe empfangen.</p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="close">
                Schließen
              </button>
              <button
                  type="button"
                  class="btn btn-primary"
                  @click="refresh"
                  :disabled="loading"
              >
                <i class="fas fa-sync-alt me-2"></i>
                Aktualisieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
import { ref, watch } from 'vue'
import { fetchPacketsForGroup } from '@/composables/useScanPackets'

export default {
  name: 'GroupDetailModal',

  props: {
    show: {
      type: Boolean,
      required: true
    },
    groupId: {
      type: Number,
      required: true
    }
  },

  emits: ['close'],

  setup(props, { emit }) {
    const loading = ref(false)
    const packets = ref([])

    async function loadPackets() {
      loading.value = true
      try {
        const today = new Date().toISOString().split('T')[0]
        packets.value = await fetchPacketsForGroup(props.groupId, today)
      } catch (error) {
        console.error('Fehler beim Laden der Gruppen-Pakete:', error)
      } finally {
        loading.value = false
      }
    }

    function close() {
      emit('close')
    }

    function refresh() {
      loadPackets()
    }

    function formatReceivedAt(isoString) {
      return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }

    watch(() => props.show, (newVal) => {
      if (newVal) {
        loadPackets()
      }
    })

    return {
      loading,
      packets,
      close,
      refresh,
      formatReceivedAt
    }
  }
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
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-content {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
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
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
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

.modal-enter-active .modal-dialog,
.modal-leave-active .modal-dialog {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-dialog,
.modal-leave-to .modal-dialog {
  transform: scale(0.9);
}

.list-group-item {
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.list-group-item:hover {
  background-color: #f8f9fa;
  border-left-color: #007bff;
}
</style>
