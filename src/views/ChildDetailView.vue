<!-- src/views/ChildDetailView.vue -->
<!-- Ticket 151 - vereinheitlichte Kindkarte: Stil/Struktur von
     ChildCardView.vue/CheckpointBusView.vue uebernommen (kompakte
     Zurueck-Taste, .cp-info-grid, kompakte Entfernen-Taste). Datenquelle
     auf useChildren().getChildById() umgestellt (camelCase), Gruppe bleibt
     Text (kein GroupLink - fuehrt auf einen requiresAdmin-Route, dieser
     Screen ist auch fuer Betreuer erreichbar). -->
<template>
  <div class="cp-child-view">
    <div class="cp-header">
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">{{ child?.name || 'Kind' }}</span>
        <button
            v-if="child"
            class="cp-remove-btn"
            title="Entfernen"
            :disabled="isDeleting"
            @click="removeChild"
        >
          <font-awesome-icon :icon="['fas', 'trash-alt']" />
        </button>
      </div>
    </div>

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
    </div>

    <template v-else-if="child">
      <!-- Presence status banner -->
      <div v-if="presenceInfo.isPresent" class="alert alert-success mb-3" role="alert">
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

      <div v-else class="alert alert-warning mb-3" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Heute noch nicht anwesend</strong>
      </div>

      <!-- Admin-only: Checkpoint-Historie fuer heute -->
      <button
          v-if="userStore.isAdmin"
          class="btn btn-outline-primary w-100 mb-3 cp-checkpoints-btn"
          @click="goToCheckpoints"
      >
        <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="me-2" />
        Checkpoints anzeigen
      </button>

      <!-- Delete error (in-place, does not hide the card) -->
      <div v-if="deleteError" class="alert alert-danger mb-3" role="alert">
        {{ deleteError }}
      </div>

      <!-- Child info grid -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="cp-info-grid">
            <div class="cp-info-item">
              <div class="cp-info-label">Alter</div>
              <div class="cp-info-value">{{ child.age }} Jahre</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Gruppe</div>
              <div class="cp-info-value">{{ child.groupId ?? '—' }}</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Schwimmabzeichen</div>
              <div class="cp-info-value">
                <span class="badge" :class="Utils.getSwimBadgeClass(child.schwimmer)">
                  {{ Utils.getSwimLevel(child.schwimmer) }}
                </span>
              </div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Armband</div>
              <div class="cp-info-value">{{ child.band_id || '—' }}</div>
            </div>
            <div class="cp-info-item cp-info-item-wide">
              <div class="cp-info-label">Notizen</div>
              <div class="cp-info-value">{{ child.notes || '—' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bearbeiten: grosse Taste mit erhoehtem Innenabstand, leichter zu treffen -->
      <button
          @click="editChild"
          class="btn btn-outline-primary btn-lg w-100 cp-edit-action-btn"
      >
        ✏️ Bearbeiten
      </button>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useScan } from '@/composables/useScan'
import { useChildren } from '@/composables/useChildren'
import { useUserStore } from '@/stores/user'
import Utils from '@/utils/utils'

const router = useRouter()
const route = useRoute()
const scanComposable = useScan()
const childrenComposable = useChildren()
const userStore = useUserStore()

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

    const data = await childrenComposable.getChildById(childId.value)

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
 * Öffnet die Checkpoint-Historie des Kindes für heute (nur Admin)
 */
function goToCheckpoints() {
  if (child.value?.id) {
    router.push({ name: 'CheckpointChildCard', params: { id: child.value.id } })
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
    const groupId = child.value.groupId
    await childrenComposable.deleteChild(child.value.id)
    router.push(groupId ? { name: 'GroupEdit', params: { id: groupId } } : { name: 'GroupEdit' })
  } catch (err) {
    console.error('Fehler beim Entfernen des Kindes:', err)
    deleteError.value = err.message || 'Fehler beim Entfernen des Kindes'
    isDeleting.value = false
  }
}

/**
 * Zurück zum vorherigen Bildschirm
 */
function goBack() {
  router.back()
}
</script>

<style scoped>
.cp-child-view {
  max-width: 700px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
}

.cp-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.cp-header-title {
  font-size: 1.4rem;
  font-weight: 700;
  flex: 1;
}

.cp-back-btn {
  border: none;
  border-radius: 8px;
  background-color: #e9ecef;
  color: #495057;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}

.cp-remove-btn {
  margin-left: auto;
  border: none;
  border-radius: 8px;
  background-color: #f8d7da;
  color: #842029;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-checkpoints-btn {
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.cp-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.cp-info-item-wide {
  grid-column: 1 / -1;
}

.cp-info-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #6c757d;
  text-transform: uppercase;
}

.cp-info-value {
  font-size: 1.1rem;
  font-weight: 600;
}

.cp-edit-action-btn {
  padding: 0.9rem 1.5rem;
  font-size: 1rem;
  margin-top: 0.5rem;
}

.alert {
  border-radius: 8px;
}

@media (max-width: 576px) {
  .cp-child-view {
    padding: 12px;
  }
}
</style>
