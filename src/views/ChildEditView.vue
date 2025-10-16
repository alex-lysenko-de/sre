<template>
  <div class="edit-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
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

    <!-- Edit form -->
    <div v-else class="card shadow-sm">
      <div class="card-header bg-primary text-white">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'edit']" />
          Kind bearbeiten: {{ formData.name || 'Lädt...' }}
        </h3>
      </div>

      <div class="card-body p-4">
        <div id="alertContainer"></div>

        <form @submit.prevent="handleSubmit">
          <!-- Name -->
          <div class="mb-3">
            <label for="childName" class="form-label">
              Name <span class="text-danger">*</span>
            </label>
            <input
                type="text"
                id="childName"
                class="form-control"
                v-model="formData.name"
                placeholder="Name des Kindes"
                required
            >
          </div>

          <!-- Age, Swimmer level, Band ID -->
          <div class="row">
            <div class="col-md-4 mb-3">
              <label for="childAge" class="form-label">
                Alter <span class="text-danger">*</span>
              </label>
              <input
                  type="number"
                  id="childAge"
                  class="form-control"
                  v-model.number="formData.age"
                  placeholder="Alter"
                  min="0"
                  max="99"
                  required
              >
            </div>

            <div class="col-md-4 mb-3">
              <label for="childSchwimm" class="form-label">
                Plätzchen (Level 0-4) <span class="text-danger">*</span>
              </label>
              <select
                  id="childSchwimm"
                  class="form-select"
                  v-model.number="formData.schwimmer"
                  required
              >
                <option :value="0">0 - Nichtschwimmer</option>
                <option :value="1">1 - Seepferdchen</option>
                <option :value="2">2 - Bronze</option>
                <option :value="3">3 - Silber</option>
                <option :value="4">4 - Gold</option>
              </select>
            </div>

            <div class="col-md-4 mb-3">
              <label for="childBandId" class="form-label">
                Armband Code (optional)
              </label>
              <input
                  type="text"
                  id="childBandId"
                  class="form-control"
                  v-model="formData.band_id"
                  placeholder="z.B. 123456789"
              >
            </div>
          </div>

          <!-- Notes -->
          <div class="mb-4">
            <label for="childNotes" class="form-label">Notizen</label>
            <textarea
                id="childNotes"
                class="form-control"
                v-model="formData.notes"
                placeholder="Besondere Hinweise (Allergien, Medikamente etc.)"
                rows="3"
            ></textarea>
          </div>

          <!-- Group info -->
          <div class="alert alert-info">
            <strong>Gruppe:</strong> {{ formData.group_id }}
          </div>

          <!-- Action buttons -->
          <div class="d-flex gap-2 justify-content-end">
            <button type="button" class="btn btn-secondary" @click="goBack">
              ↩️ Abbrechen
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isSaving">
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
              <font-awesome-icon v-else :icon="['fas', 'save']" class="me-1" />
              {{ isSaving ? 'Wird gespeichert...' : 'Speichern' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useArmband } from '@/composables/useArmband'
import { useChildren } from '@/composables/useChildren'

const router = useRouter()
const route = useRoute()
const armbandComposable = useArmband()
const { saveChild } = useChildren()

const childId = computed(() => route.params.id)

const isLoading = ref(true)
const isSaving = ref(false)
const error = ref(null)
const formData = ref({
  id: null,
  name: '',
  age: '',
  schwimmer: 0,
  notes: '',
  band_id: '',
  group_id: null
})

onMounted(async () => {
  await loadChildData()
})

/**
 * Загрузить данные ребенка
 */
async function loadChildData() {
  try {
    isLoading.value = true
    error.value = null

    const data = await armbandComposable.getChildDetails(childId.value)

    if (!data) {
      throw new Error('Kind nicht gefunden')
    }

    // Заполняем форму данными ребенка
    formData.value = {
      id: data.id,
      name: data.name || '',
      age: data.age || '',
      schwimmer: data.schwimmer || 0,
      notes: (data.notes && data.notes.trim() !== '""') ? data.notes : '',
      band_id: data.band_id || '',
      group_id: data.group_id
    }
  } catch (err) {
    console.error('Fehler beim Laden der Kinderdaten:', err)
    error.value = err.message || 'Fehler beim Laden der Kinderdaten'
  } finally {
    isLoading.value = false
  }
}

/**
 * Валидация формы
 */
function validateForm() {
  const name = formData.value.name.trim()
  const age = formData.value.age
  const schwimmer = formData.value.schwimmer
  const bandId = formData.value.band_id

  if (!name) {
    showAlert('Bitte geben Sie einen Namen für das Kind ein.', 'warning')
    return false
  }

  if (!Number.isInteger(Number(age)) || Number(age) <= 0 || Number(age) > 99) {
    showAlert('Bitte geben Sie ein gültiges Alter (positive Zahl bis 99) ein.', 'warning')
    return false
  }

  if (!Number.isInteger(Number(schwimmer)) || Number(schwimmer) < 0 || Number(schwimmer) > 4) {
    showAlert('Bitte wählen Sie ein gültiges Plätzchen-Level (0 bis 4).', 'warning')
    return false
  }

  if (bandId && (isNaN(Number(bandId)) || !Number.isInteger(Number(bandId)) || Number(bandId) <= 0)) {
    showAlert('Armband Code muss eine positive Ganzzahl sein.', 'warning')
    return false
  }

  return true
}

/**
 * Обработка отправки формы
 */
async function handleSubmit() {
  if (!validateForm()) {
    return
  }

  isSaving.value = true
  error.value = null

  try {
    const childData = {
      id: formData.value.id,
      name: formData.value.name.trim(),
      age: parseInt(formData.value.age),
      schwimmer: parseInt(formData.value.schwimmer),
      notes: formData.value.notes.trim(),
      group_id: formData.value.group_id,
      band_id: formData.value.band_id ? String(formData.value.band_id) : null
    }

    const { data, message } = await saveChild(childData)

    showAlert(message, 'success')

    // Перенаправляем на страницу ребенка через 1 сек
    setTimeout(() => {
      router.push({ name: 'ChildDetail', params: { id: data.id } })
    }, 1000)
  } catch (err) {
    console.error('Fehler beim Speichern:', err)
    error.value = `Fehler beim Speichern: ${err.message}`
    showAlert(error.value, 'danger')
    isSaving.value = false
  }
}

/**
 * Вывести сообщение в контейнер
 */
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alertContainer')
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
    if (alertDiv.parentElement) {
      alertDiv.remove()
    }
  }, 5000)
}

/**
 * Вернуться назад
 */
function goBack() {
  router.back()
}
</script>

<style scoped>
.edit-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.card {
  border: none;
  border-radius: 12px;
}

.card-header {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  padding: 1.5rem;
}

.form-label {
  font-weight: 500;
}

.form-control:focus,
.form-select:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

.alert {
  border-radius: 8px;
}

.d-flex.gap-2 {
  gap: 0.5rem;
}

@media (max-width: 576px) {
  .edit-container {
    padding: 1rem;
  }

  .d-flex.gap-2 {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>