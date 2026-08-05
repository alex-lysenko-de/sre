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
	  
	    <!-- Action buttons -->
        <div class="d-grid gap-2 mb-3">
          <!-- Back to group button -->
          <button
              @click="goBack"
              class="btn btn-outline-secondary w-100"
          >
            ↩️ Zurück
          </button>
        </div>
	  
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

        <!-- Delete error (in-place, does not hide the card) -->
        <div v-if="deleteError" class="alert alert-danger mb-3" role="alert">
          {{ deleteError }}
        </div>

        <div class="d-grid gap-2 mb-3">
          <button
              @click="editChild"
              class="btn btn-outline-primary btn-lg"
          >
            ✏️ Bearbeiten
          </button>
          <button
              @click="removeChild"
              class="btn btn-outline-danger btn-lg"
              :disabled="isDeleting"
          >
            🗑️ {{ isDeleting ? 'Wird entfernt...' : 'Entfernen' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useArmband } from '@/composables/useArmband'
import { useScan } from '@/composables/useScan'
import { useChildren } from '@/composables/useChildren'
import Utils from '@/utils/utils'

const router = useRouter()
const route = useRoute()
const armbandComposable = useArmband()
const scanComposable = useScan()
const childrenComposable = useChildren()

const childId = computed(() => route.params.id)

const isLoading = ref(true)
const error = ref(null)
const deleteError = ref(null)
const isDeleting = ref(false)
const child = ref(null)
const presenceInfo = ref({
  isPresent: false,
  busId: null
})

onMounted(async () => {
  await loadChildDetails()
  await loadPresenceInfo()
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
 * Bearbeitet Kinderdaten
 */
function editChild() {
  if (child.value?.id) {
    router.push({ name: 'ChildDetailEdit', params: { id: child.value.id } })
  }
}

/**
 * Entfernt das Kind nach Bestätigung und kehrt zur Gruppenliste zurück.
 */
async function removeChild() {
  if (!child.value?.id || isDeleting.value) {
    return
  }

  if (!confirm(`Möchten Sie das Kind "${child.value.name}" (ID: ${child.value.id}) wirklich entfernen?`)) {
    return
  }

  isDeleting.value = true
  deleteError.value = null

  try {
    const groupId = child.value.group_id
    await childrenComposable.deleteChild(child.value.id)
    router.push(groupId ? { name: 'GroupEdit', params: { id: groupId } } : { name: 'GroupEdit' })
  } catch (err) {
    console.error('Fehler beim Entfernen des Kindes:', err)
    deleteError.value = err.message || 'Fehler beim Entfernen des Kindes'
    isDeleting.value = false
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