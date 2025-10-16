<template>
  <div class="container my-4">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card shadow-sm">
          <div class="card-header bg-primary text-white">
            <h5 class="modal-title">
              <font-awesome-icon :icon="['fas', 'child']" />
              Detailansicht: {{ childData ? childData.name : 'Kind wird geladen...' }}
            </h5>
          </div>

          <div class="card-body">
            <div id="detailAlertContainer"></div>

            <div v-if="loading" class="text-center py-5">
              <div class="spinner-border mb-3" role="status">
                <span class="visually-hidden">Wird geladen...</span>
              </div>
              <p class="text-muted">Lade Kinderdaten...</p>
            </div>

            <div v-else-if="!childData" class="text-center py-5">
              <font-awesome-icon :icon="['fas', 'exclamation-triangle']" />
              <h5 class="text-muted">Kind nicht gefunden.</h5>
              <p class="text-muted">Die angeforderte Kinder-ID existiert nicht oder konnte nicht geladen werden.</p>
            </div>

            <form v-else>
              <div class="mb-3">
                <label for="childName" class="form-label fw-semibold">Name</label>
                <input type="text" id="childName" class="form-control" :value="childData.name" readonly />
              </div>

              <div class="row">
                <div class="col-md-4 mb-3">
                  <label for="childAge" class="form-label fw-semibold">Alter</label>
                  <input type="number" id="childAge" class="form-control" :value="childData.age" readonly />
                </div>

                <div class="col-md-4 mb-3">
                  <label for="childGroup" class="form-label fw-semibold">Gruppe</label>
                  <input type="text" id="childGroup" class="form-control" :value="childData.group_id" readonly />
                </div>

                <div class="col-md-4 mb-3">
                  <label for="childBandId" class="form-label fw-semibold">Armband Code</label>
                  <input type="text" id="childBandId" class="form-control" :value="childData.band_id || '—'" readonly />
                </div>
              </div>

              <div class="mb-3">
                <label for="childSchwimm" class="form-label fw-semibold">Schwimmer (Level)</label>
                <p class="form-control-plaintext">
                  <span class="badge p-2" :class="getSwimBadgeClass(childData.schwimmer)">
                    {{ getSwimLevel(childData.schwimmer) }}
                  </span>
                </p>
              </div>

              <div class="mb-3">
                <label for="childNotes" class="form-label fw-semibold">Notizen</label>
                <textarea
                    id="childNotes"
                    class="form-control"
                    :value="cleanNotes(childData.notes)"
                    rows="4"
                    readonly
                ></textarea>
              </div>

              <div class="d-grid gap-2 mt-4">
                <button type="button" class="btn btn-secondary btn-lg" @click="goBack">
                  <font-awesome-icon :icon="['fas', 'arrow-left']" />
                  Zurück
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChildren } from '@/composables/useChildren' // Assuming the path is correct

const route = useRoute()
const router = useRouter()
const { fetchChildById } = useChildren()

const childData = ref(null)
const loading = ref(true)

// --- Static data and utility functions (copied from GroupEditView.vue for local use) ---
const SWIM_LEVELS = {
  0: '0 - Nichtschwimmer',
  1: '1 - Seepferdchen',
  2: '2 - Bronze',
  3: '3 - Silber',
  4: '4 - Gold',
}
const SWIM_BADGE_CLASSES = {
  0: 'bg-danger text-white',
  1: 'bg-warning text-dark',
  2: 'bg-secondary text-warning',
  3: 'bg-light text-secondary',
  4: 'bg-dark text-warning',
}

function getSwimLevel(level) {
  return SWIM_LEVELS[level] || 'Unbekannt'
}
function getSwimBadgeClass(level) {
  return SWIM_BADGE_CLASSES[level] || 'bg-light text-dark'
}

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('detailAlertContainer')
  if (!alertContainer) return

  alertContainer.innerHTML = ''

  const alertDiv = document.createElement('div')
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`
  alertDiv.role = 'alert'
  alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `
  alertContainer.appendChild(alertDiv)

  setTimeout(() => {
    alertDiv.remove()
  }, 5000)
}

function cleanNotes(notes) {
  const noteText = notes || '';
  return noteText.trim() !== '""' ? noteText.trim() : '';
}
// -------------------------------------------------------------------------------------

/**
 * Load child data from the database using the ID from the route.
 */
async function loadChildData() {
  loading.value = true
  const childId = parseInt(route.params.id)

  if (isNaN(childId)) {
    showAlert('Ungültige Kinder-ID in der URL.', 'danger')
    loading.value = false
    return
  }

  try {
    const data = await fetchChildById(childId)
    childData.value = data
    if (!data) {
      showAlert('Kind nicht gefunden.', 'warning')
    }
  } catch (error) {
    showAlert(`Fehler beim Laden der Kinderdaten: ${error.message}`, 'danger')
  } finally {
    loading.value = false
  }
}

/**
 * Navigate back using the browser history.
 */
function goBack() {
  router.back()
}

onMounted(loadChildData)
</script>

<style scoped>
.card-header {
  background-color: #007bff; /* Primary color */
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

.form-label {
  font-weight: 500;
  color: #495057;
}

/* Style to make readonly inputs look better */
.form-control[readonly],
.form-control-plaintext {
  background-color: #e9ecef;
  opacity: 1;
  border: 1px solid #ced4da;
  padding: 0.375rem 0.75rem;
  border-radius: 0.25rem;
}

textarea.form-control[readonly] {
  resize: none;
  min-height: 100px;
}

.form-control-plaintext {
  display: block;
  width: 100%;
  margin-bottom: 0;
  line-height: 1.5;
}

.form-control-plaintext .badge {
  font-size: 1rem;
  font-weight: normal;
}
</style>