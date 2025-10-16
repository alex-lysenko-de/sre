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
      <button @click="goBack" class="btn btn-secondary btn-sm">
        ↩️ Zurück
      </button>
    </div>

    <!-- Child detail card -->
    <div v-else-if="child" class="card shadow-sm">
      <div class="card-body p-4">
        <!-- Header -->
        <div class="d-flex align-items-start justify-content-between mb-4">
          <div>
            <h2 class="card-title mb-1">
              👶 {{ child.name }}
            </h2>
            <p class="text-muted mb-0">ID: {{ child.id }}</p>
          </div>
          <button
              @click="goBack"
              class="btn btn-sm btn-outline-secondary"
              title="Zurück"
          >
            ↩️
          </button>
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
              <span class="info-label">🏊 Plätzchen</span>
              <span class="info-value">
                <span v-if="child.schwimmer === 1" class="badge bg-success">
                  Ja ✅
                </span>
                <span v-else class="badge bg-secondary">
                  Nein ❌
                </span>
              </span>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="info-block">
              <span class="info-label">📍 Armband</span>
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
              @click="markPresence"
              :disabled="isMarkingPresence"
              class="btn btn-success btn-lg"
          >
            <span v-if="!isMarkingPresence">✅ Anwesend markieren</span>
            <span v-else>
              <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Wird registriert...
            </span>
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
          ↩️ Zurück zur Gruppe
        </button>

        <!-- Success message -->
        <div v-if="successMessage" class="alert alert-success mt-3" role="alert">
          {{ successMessage }}
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

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const armbandComposable = useArmband()

const childId = computed(() => route.params.id)

const isLoading = ref(true)
const isMarkingPresence = ref(false)
const error = ref(null)
const successMessage = ref(null)
const child = ref(null)

onMounted(async () => {
  await loadChildDetails()
})

/**
 * Загрузить детали ребенка
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
 * Отметить присутствие ребенка
 */
async function markPresence() {
  try {
    isMarkingPresence.value = true
    error.value = null
    successMessage.value = null

    // Проверяем, есть ли данные пользователя и ребенка
    if (!userStore.userInfo.id) {
      throw new Error('Benutzer nicht authentifiziert')
    }

    if (!child.value.id) {
      throw new Error('Kind-ID nicht gefunden')
    }

    if (!child.value.band_id) {
      throw new Error('Armband für dieses Kind nicht zugeordnet')
    }

    // Регистрируем присутствие
    await armbandComposable.recordChildPresence(
        userStore.userInfo.id,
        child.value.id,
        child.value.band_id
    )

    successMessage.value = `✅ Präsenz für ${child.value.name} registriert`

    // Скрываем сообщение через 3 секунды
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
 * Редактировать ребенка
 */
function editChild() {
  if (child.value?.id) {
    router.push({ name: 'ChildEdit', params: { id: child.value.id } })
  }
}

/**
 * Вернуться назад
 */
function goBack() {
  router.back()
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