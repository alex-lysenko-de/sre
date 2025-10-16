<template>
  <div class="armband-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Lädt...</span>
      </div>
      <p class="mt-3 text-muted">Armband wird überprüft...</p>
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

    <!-- Armband assignment form -->
    <div v-else-if="!childData && !isAssigning" class="card shadow-sm">
      <div class="card-body p-4">
        <h3 class="card-title mb-4">
          📍 Armband Zuordnung
        </h3>

        <p class="text-muted mb-4">
          Dieser Armband ist noch keinem Kind zugeordnet.<br>
          Bitte wählen Sie ein Kind aus Ihrer Gruppe aus.
        </p>

        <!-- Group info -->
        <div class="alert alert-info mb-4">
          <strong>Ihre Gruppe:</strong> {{ currentGroupId }}
        </div>

        <!-- Children select -->
        <div class="mb-3">
          <label for="childSelect" class="form-label fw-bold">
            👶 Kind auswählen
          </label>
          <select
              id="childSelect"
              v-model="selectedChildId"
              class="form-select form-select-lg"
              :disabled="children.length === 0"
          >
            <option value="">-- Bitte wählen Sie ein Kind --</option>
            <option
                v-for="child in children"
                :key="child.id"
                :value="child.id"
            >
              {{ child.name }} ({{ child.age }} Jahre)
              <span v-if="child.band_id"> - Armband: {{ child.band_id }}</span>
            </option>
          </select>
        </div>

        <!-- No children warning -->
        <div v-if="children.length === 0" class="alert alert-warning">
          ⚠️ Keine Kinder in Ihrer Gruppe gefunden.
        </div>

        <!-- Action buttons -->
        <div class="d-flex gap-2">
          <button
              @click="assignArmband"
              :disabled="!selectedChildId || isAssigning"
              class="btn btn-success btn-lg"
          >
            <span v-if="!isAssigning">✅ Armband zuordnen</span>
            <span v-else>
              <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Wird zugeordnet...
            </span>
          </button>
          <button
              @click="goBack"
              class="btn btn-secondary btn-lg"
          >
            ↩️ Abbrechen
          </button>
        </div>
      </div>
    </div>

    <!-- Assignment success state -->
    <div v-else-if="isAssigning" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Wird zugeordnet...</span>
      </div>
      <p class="mt-3 text-muted">Armband wird zugeordnet...</p>
    </div>

    <!-- Child data already exists - redirect in progress -->
    <div v-else class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Wird weitergleitet...</span>
      </div>
      <p class="mt-3 text-muted">Kind wird geladen...</p>
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

const bandId = computed(() => route.params.id)
const currentGroupId = computed(() => userStore.userInfo.group_id)

const isLoading = ref(true)
const isAssigning = ref(false)
const error = ref(null)
const childData = ref(null)
const children = ref([])
const selectedChildId = ref('')

onMounted(async () => {
  await checkBraceletStatus()
})

/**
 * Проверить статус браслета
 */
async function checkBraceletStatus() {
  try {
    isLoading.value = true
    error.value = null

    // Получаем статус браслета
    const status = await armbandComposable.getBraceletStatus(bandId.value)

    if (status) {
      // Браслет уже привязан, сохраняем данные и перенаправляем
      childData.value = status
      console.log(`✅ Armband ${bandId.value} уже привязан к ребенку ${status.name}`)

      // Перенаправляем на страницу ребенка
      await router.push({ name: 'ChildDetail', params: { id: status.id } })
    } else {
      // Браслет не привязан, загружаем список детей группы
      await loadChildren()
    }
  } catch (err) {
    console.error('Fehler beim Überprüfen des Armband-Status:', err)
    error.value = err.message || 'Fehler beim Überprüfen des Armbands'
  } finally {
    isLoading.value = false
  }
}

/**
 * Загрузить список детей текущей группы
 */
async function loadChildren() {
  try {
    const groupId = currentGroupId.value

    if (!groupId) {
      throw new Error('Ihre Gruppe ist nicht definiert. Bitte aktualisieren Sie die Seite.')
    }

    const data = await armbandComposable.getChildrenByGroup(groupId)
    children.value = data

    if (data.length === 0) {
      console.warn('Keine Kinder in der Gruppe gefunden')
    }
  } catch (err) {
    console.error('Fehler beim Laden der Kinder:', err)
    error.value = err.message || 'Fehler beim Laden der Kinderliste'
  }
}

/**
 * Привязать браслет к выбранному ребенку
 */
async function assignArmband() {
  try {
    if (!selectedChildId.value) {
      error.value = 'Bitte wählen Sie ein Kind aus'
      return
    }

    isAssigning.value = true
    error.value = null

    // Привязываем браслет
    const updatedChild = await armbandComposable.assignBraceletToChild(
        selectedChildId.value,
        bandId.value
    )

    console.log(`✅ Armband erfolgreich zugeordnet. Weiterleitung zur Seite des Kindes...`)

    // Перенаправляем на страницу ребенка
    await router.push({ name: 'ChildDetail', params: { id: updatedChild.id } })
  } catch (err) {
    console.error('Fehler beim Zuordnen des Armbands:', err)
    error.value = err.message || 'Fehler beim Zuordnen des Armbands'
    isAssigning.value = false
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
.armband-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.card {
  border: none;
  border-radius: 12px;
}

.form-select-lg {
  font-size: 1.1rem;
  padding: 0.75rem 1rem;
}

.btn-lg {
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
}

.alert {
  border-radius: 8px;
}

@media (max-width: 576px) {
  .armband-container {
    padding: 1rem;
  }

  .d-flex.gap-2 {
    flex-direction: column;
  }

  .btn-lg {
    width: 100%;
  }
}
</style>