<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-backdrop" @click.self="close">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <!-- Header -->
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-bus me-2"></i>
                Bus {{ busNumber }} - Details
              </h5>
              <button type="button" class="btn-close" @click="close"></button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              <!-- Loading State -->
              <div v-if="loading" class="text-center py-5">
                <div class="spinner-border mb-3"></div>
                <p class="text-muted">Lade Bus-Details...</p>
              </div>

              <!-- Content -->
              <div v-else>
                <!-- Summary Cards -->
                <div class="row mb-4">
                  <div class="col-md-6">
                    <div class="card bg-primary text-white">
                      <div class="card-body text-center">
                        <h2 class="display-4 mb-0">{{ busData.kinder_count }}</h2>
                        <p class="mb-0">Kinder</p>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="card bg-success text-white">
                      <div class="card-body text-center">
                        <h2 class="display-4 mb-0">{{ busData.betreuer_count }}</h2>
                        <p class="mb-0">Betreuer</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Betreuer Liste -->
                <div v-if="busData.betreuer_count > 0" class="mb-4">
                  <h6 class="border-bottom pb-2">
                    <i class="fas fa-user-friends me-2"></i>
                    Betreuer in diesem Bus
                  </h6>
                  <div class="list-group">
                    <div
                        v-for="(betreuer, idx) in betreuerDetails"
                        :key="idx"
                        class="list-group-item d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <i class="fas fa-user-circle me-2 text-muted"></i>
                        <strong>{{ betreuer.name }}</strong>
                        <span v-if="betreuer.group" class="text-muted ms-2">
                          (Gruppe {{ betreuer.group }})
                        </span>
                      </div>
                      <span class="badge bg-success">Betreuer</span>
                    </div>
                  </div>
                </div>

                <!-- Kinder Liste -->
                <div v-if="busData.kinder_count > 0" class="mb-4">
                  <h6 class="border-bottom pb-2">
                    <i class="fas fa-child me-2"></i>
                    Kinder in diesem Bus ({{ busData.kinder_count }})
                  </h6>
                  <div class="list-group" style="max-height: 400px; overflow-y: auto;">
                    <div
                        v-for="child in childrenDetails"
                        :key="child.id"
                        class="list-group-item d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <strong>{{ child.name }}</strong>
                        <span class="text-muted ms-2">
                          ({{ child.age }} Jahre, Gruppe {{ child.group_id }})
                        </span>
                        <div v-if="child.schwimmer === 1" class="mt-1">
                          <span class="badge bg-info">
                            <i class="fas fa-swimmer me-1"></i>Schwimmer
                          </span>
                        </div>
                      </div>
                      <span class="badge bg-primary">Kind</span>
                    </div>
                  </div>
                </div>

                <!-- Keine Daten -->
                <div v-if="busData.kinder_count === 0 && busData.betreuer_count === 0" class="text-center py-5">
                  <i class="fas fa-info-circle fa-3x text-muted mb-3"></i>
                  <h5 class="text-muted">Keine Daten für diesen Bus</h5>
                  <p class="text-muted">Dieser Bus ist heute nicht aktiv.</p>
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
import { useBusData } from '@/composables/useBusData'

export default {
  name: 'BusDetailModal',

  props: {
    show: {
      type: Boolean,
      required: true
    },
    busNumber: {
      type: Number,
      required: true
    }
  },

  emits: ['close'],

  setup(props, { emit }) {
    const { fetchBusChildren, fetchBusBetreuer } = useBusData()

    const loading = ref(false)
    const busData = ref({
      kinder_count: 0,
      betreuer_count: 0
    })
    const betreuerDetails = ref([])
    const childrenDetails = ref([])

    // ============================================================================
    // METHODS
    // ============================================================================

    async function loadBusDetails() {
      loading.value = true

      try {
        const today = new Date().toISOString().split('T')[0]

        // 1. Betreuer laden
        const betreuer = await fetchBusBetreuer(props.busNumber, today)
        betreuerDetails.value = betreuer

        // 2. Kinder laden
        const children = await fetchBusChildren(props.busNumber)
        childrenDetails.value = children

        // 3. Zähler aktualisieren
        busData.value = {
          kinder_count: children.length,
          betreuer_count: betreuer.length
        }

      } catch (error) {
        console.error('Fehler beim Laden der Bus-Details:', error)
      } finally {
        loading.value = false
      }
    }

    function close() {
      emit('close')
    }

    function refresh() {
      loadBusDetails()
    }

    // Watch for modal open
    watch(() => props.show, (newVal) => {
      if (newVal) {
        loadBusDetails()
      }
    })

    return {
      loading,
      busData,
      betreuerDetails,
      childrenDetails,
      close,
      refresh
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

/* Transitions */
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

/* List styling */
.list-group-item {
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.list-group-item:hover {
  background-color: #f8f9fa;
  border-left-color: #007bff;
}

/* Card styling */
.card {
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Scrollbar styling */
.list-group::-webkit-scrollbar {
  width: 8px;
}

.list-group::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.list-group::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.list-group::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>