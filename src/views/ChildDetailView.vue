<!-- src/views/ChildDetailView.vue -->
<template>
  <div class="child-detail-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Lädt...</span>
      </div>
      <p class="mt-3 text-muted">Kind wird geladen...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="alert alert-danger" role="alert">
      <h4 class="alert-heading">⚠️ Fehler</h4>
      <p>{{ error }}</p>
      <hr>
    </div>

    <!-- Child detail card -->
    <div v-else-if="child" class="card shadow-sm">
      <div class="card-body p-4">
        <!-- Header -->
        <div class="d-flex align-items-start justify-content-center mb-4">
          <div>
            <h2 class="card-title mb-1">
              {{ child.name }}
            </h2>
          </div>
        </div>

        <!-- Presence status banner -->
        <div v-if="presenceInfo.isPresent" class="alert alert-success mb-4" role="alert">
          <div class="d-flex align-items-center">
            <i class="fas fa-check-circle me-2 fs-5"></i>
            <div>
              <strong>✅ Heute anwesend</strong>
              <div v-if="presenceInfo.busId" class="mt-1">
                <i class="fas fa-bus me-1"></i>
                <span>Fährt in Bus <strong>#{{ presenceInfo.busId }}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="alert alert-warning mb-4" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>Heute noch nicht anwesend</strong>
        </div>

        <!-- Child info grid -->
        <div class="row mb-4">
          <div class="col-md-6 mb-3">
            <div class="info-block">
              <span class="info-label">🎂 Alter</span>
              <span class="info-value">{{ child.age }} Jahre</span>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="info-block">
              <span class="info-label">👥 Gruppe</span>
              <span class="info-value">{{ child.group_id }}</span>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="info-block">
              <span class="info-label">🏊 Schwimmabzeichen</span>
              <span class="info-value">
                <span class="badge" :class="Utils.getSwimBadgeClass(child.schwimmer)">
                  {{ Utils.getSwimLevel(child.schwimmer) }}
                </span>
              </span>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="info-block">
              <span class="info-label">🏷️ Armband</span>
              <span class="info-value">
                <span v-if="child.band_id" class="badge bg-info">
                  {{ child.band_id }}
                </span>
                <span v-else class="text-muted">
                  Nicht zugeordnet
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- Notes section -->
        <div v-if="child.notes" class="mb-4">
          <h5 class="mb-2">📝 Notizen</h5>
          <div class="alert alert-light border">
            {{ child.notes }}
          </div>
        </div>

        <!-- Action buttons -->
        <div class="d-grid gap-2 mb-3">
          <button
              @click="openPresenceModal"
              class="btn btn-success btn-lg"
          >
            ✅ Präsenz registrieren
          </button>

          <button
              @click="editChild"
              class="btn btn-outline-primary btn-lg"
          >
            ✏️ Bearbeiten
          </button>
        </div>

        <!-- Back to group button -->
        <button
            @click="goBack"
            class="btn btn-outline-secondary w-100"
        >
          ↩️ Zurück
        </button>

        <!-- Success message -->
        <div v-if="successMessage" class="alert alert-success mt-3" role="alert">
          {{ successMessage }}
        </div>
      </div>
    </div>

    <!-- Presence Modal -->
    <div
        class="modal fade"
        id="presenceModal"
        tabindex="-1"
        aria-labelledby="presenceModalLabel"
        aria-hidden="true"
        ref="presenceModalElement"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="presenceModalLabel">
              <i class="fas fa-clipboard-check me-2"></i>
              Präsenz registrieren
            </h5>
            <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <p class="mb-3">
                <strong>{{ child?.name }}</strong> wird als anwesend markiert.
              </p>

              <!-- Bus ID hinzufügen Checkbox -->
              <div class="form-check mb-3">
                <input
                    class="form-check-input"
                    type="checkbox"
                    v-model="modalData.includeBusId"
                    id="includeBusCheckbox"
                >
                <label class="form-check-label" for="includeBusCheckbox">
                  <i class="fas fa-bus me-1"></i>
                  Bus-Nummer hinzufügen
                </label>
              </div>

              <!-- Bus Auswahl -->
              <div v-if="modalData.includeBusId" class="mb-3">
                <label for="busSelect" class="form-label">
                  <i class="fas fa-bus me-1"></i>
                  Bus-Nummer
                </label>
                <select
                    class="form-select"
                    id="busSelect"
                    v-model="modalData.selectedBusId"
                >
                  <option :value="null">Kein Bus</option>
                  <option v-for="n in 10" :key="n" :value="n">
                    Bus #{{ n }}
                  </option>
                </select>
              </div>

              <!-- Info Text -->
              <div class="alert alert-info small mb-0">
                <i class="fas fa-info-circle me-1"></i>
                {{ getModalInfoText() }}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
                type="button"
                class="btn btn-secondary"
                data-bs-dismiss="modal"
            >
              Abbrechen
            </button>
            <button
                type="button"
                class="btn btn-success"
                @click="confirmPresence"
                :disabled="isMarkingPresence"
            >
              <span v-if="!isMarkingPresence">
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useArmband } from '@/composables/useArmband'
import { useScan } from '@/composables/useScan'
import Utils from '@/utils/utils'
import { Modal } from 'bootstrap'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const armbandComposable = useArmband()
const scanComposable = useScan()

const childId = computed(() => route.params.id)

const isLoading = ref(true)
const isMarkingPresence = ref(false)
const error = ref(null)
const successMessage = ref(null)
const child = ref(null)
const presenceInfo = ref({
  isPresent: false,
  busId: null
})

const presenceModalElement = ref(null)
let presenceModal = null

const modalData = ref({
  includeBusId: false,
  selectedBusId: null
})

onMounted(async () => {
  await loadChildDetails()
  await loadPresenceInfo()

  // Initialize Bootstrap modal
  if (presenceModalElement.value) {
    presenceModal = new Modal(presenceModalElement.value)
  }
})

/**
 * Lädt Kinderdaten
 */
async function loadChildDetails() {
  try {
    isLoading.value = true
    error.value = null

    const data = await armbandComposable.getChildDetails(childId.value)

    if (!data) {
      throw new Error('Kind nicht gefunden')
    }

    child.value = data
  } catch (err) {
    console.error('Fehler beim Laden der Kinderdaten:', err)
    error.value = err.message || 'Fehler beim Laden der Kinderdaten'
  } finally {
    isLoading.value = false
  }
}

/**
 * Lädt Anwesenheitsinformationen für heute
 */
async function loadPresenceInfo() {
  try {
    const isPresent = await scanComposable.isChildPresentToday(childId.value)
    let busId = null

    if (isPresent) {
      busId = await scanComposable.getChildBusForToday(childId.value)
    }

    presenceInfo.value = {
      isPresent,
      busId
    }

    console.log(`📊 Anwesenheit: ${isPresent}, Bus: ${busId || 'nicht zugewiesen'}`)
  } catch (err) {
    console.error('Fehler beim Laden der Anwesenheitsinformationen:', err)
  }
}

/**
 * Öffnet Modal mit intelligenten Voreinstellungen
 */
async function openPresenceModal() {
  try {
    // Smart defaults basierend auf Anwesenheitsstatus
    const hasBusInfo = presenceInfo.value.busId !== null
    const userBusId = userStore.userInfo.bus_id

    // Logik:
    // 1. Wenn Kind noch nicht anwesend oder kein Bus zugewiesen -> Checkbox AN
    // 2. Wenn Kind bereits anwesend und Bus zugewiesen -> Checkbox AUS
    modalData.value.includeBusId = !presenceInfo.value.isPresent || !hasBusInfo

    // Bus-Nummer vom User vorausfüllen (falls vorhanden)
    modalData.value.selectedBusId = userBusId || null

    console.log(`🎯 Modal-Defaults: includeBus=${modalData.value.includeBusId}, busId=${modalData.value.selectedBusId}`)

    // Modal öffnen
    if (presenceModal) {
      presenceModal.show()
    }
  } catch (err) {
    console.error('Fehler beim Öffnen des Modals:', err)
  }
}

/**
 * Info-Text für Modal basierend auf Status
 */
function getModalInfoText() {
  if (!presenceInfo.value.isPresent) {
    return 'Erste Anwesenheitsprüfung heute - Bus-Nummer wird empfohlen.'
  } else if (presenceInfo.value.busId) {
    return `Kind ist bereits in Bus #${presenceInfo.value.busId} registriert. Bus-Nummer nur ändern, wenn nötig.`
  } else {
    return 'Kind ist bereits anwesend. Bus-Nummer bei Bedarf hinzufügen.'
  }
}

/**
 * Bestätigt Präsenz und erstellt Scan
 */
async function confirmPresence() {
  try {
    isMarkingPresence.value = true
    error.value = null
    successMessage.value = null

    if (!userStore.userInfo.id) {
      throw new Error('Benutzer nicht authentifiziert')
    }

    if (!child.value.id) {
      throw new Error('Kind-ID nicht gefunden')
    }

    if (!child.value.band_id) {
      throw new Error('Armband für dieses Kind nicht zugeordnet')
    }

    // Bus-ID nur hinzufügen wenn Checkbox aktiviert
    const busIdToSave = modalData.value.includeBusId ? modalData.value.selectedBusId : null

    // Erstelle Scan-Eintrag
    await scanComposable.createScan({
      user_id: userStore.userInfo.id,
      child_id: child.value.id,
      band_id: child.value.band_id,
      bus_id: busIdToSave,
      type: 1 // Präsenz
    })

    // Modal schließen
    if (presenceModal) {
      presenceModal.hide()
    }

    // Success-Nachricht
    let message = `✅ Präsenz für ${child.value.name} registriert`
    if (busIdToSave) {
      message += ` (Bus #${busIdToSave})`
    }
    successMessage.value = message

    // Aktualisiere Anwesenheitsinformationen
    await loadPresenceInfo()

    // Verstecke Nachricht nach 3 Sekunden
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (err) {
    console.error('Fehler beim Registrieren der Präsenz:', err)
    error.value = err.message || 'Fehler beim Registrieren der Präsenz'
  } finally {
    isMarkingPresence.value = false
  }
}

/**
 * Bearbeitet Kinderdaten
 */
function editChild() {
  if (child.value?.id) {
    router.push({ name: 'ChildDetailEdit', params: { id: child.value.id } })
  }
}

/**
 * Zurück zur Hauptseite
 */
function goBack() {
  router.push('/main')
}
</script>

<style scoped>
.child-detail-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.card {
  border: none;
  border-radius: 12px;
}

.info-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.info-label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.btn-lg {
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
}

.alert {
  border-radius: 8px;
}

.alert-success {
  background-color: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.alert-warning {
  background-color: #fff3cd;
  border-color: #ffeaa7;
  color: #856404;
}

.modal-content {
  border-radius: 12px;
  border: none;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  border-radius: 12px 12px 0 0;
}

.modal-title {
  color: #198754;
  font-weight: 600;
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
  .child-detail-container {
    padding: 1rem;
  }

  .d-grid {
    gap: 0.5rem !important;
  }

  .btn-lg {
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
  }

  .info-block {
    padding: 0.75rem;
  }

  .info-value {
    font-size: 1.1rem;
  }
}
</style>