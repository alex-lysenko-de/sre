/* src/views/ArmbandView.vue */


<template>
  <div class="armband-container">
    <!-- Ladezustand -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Lädt...</span>
      </div>
      <p class="mt-3 text-muted">Armband wird überprüft...</p>
    </div>

    <!-- Fehlerzustand -->
    <div v-else-if="error" class="alert alert-danger" role="alert">
      <h4 class="alert-heading">⚠️ Fehler</h4>
      <p>{{ error }}</p>
      <hr>
      <button @click="goBack" class="btn btn-secondary btn-sm">
        ↩️ Zurück
      </button>
    </div>

    <!-- Formular zur Armband-Zuordnung -->
    <div v-else-if="!childData && !isAssigning" class="card shadow-sm">
      <div class="card-body p-4">
        <h3 class="card-title mb-4">
          📍 Armband‑Zuordnung
        </h3>

        <p class="text-muted mb-4">
          Dieses Armband ist noch keinem Kind zugeordnet.<br>
          Bitte wählen Sie ein Kind aus Ihrer Gruppe aus.
        </p>

        <!-- Gruppeninfo -->
        <div class="alert alert-info mb-4">
          <strong>Ihre Gruppe:</strong> {{ currentGroupId }}
        </div>

        <!-- Liste der Kinder mit Radio-Buttons -->
        <div class="mb-3">
          <label for="childSelect" class="form-label fw-bold">
            👶 Kind auswählen
          </label>
          <ul class="list-group">
            <li v-for="child in children" :key="child.id" class="list-group-item">
              <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    :id="'child-' + child.id"
                    :value="child.id"
                    v-model="selectedChildId"
                >
                <label class="form-check-label" :for="'child-' + child.id">
                  {{ child.name }} ({{ child.age }} J)
                </label>
              </div>
            </li>
          </ul>
        </div>

        <!-- Warnung: keine Kinder -->
        <div v-if="children.length === 0" class="alert alert-warning">
          ⚠️ Keine Kinder in Ihrer Gruppe gefunden.
        </div>

        <!-- Aktionstasten -->
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

    <!-- Zuordnung läuft -->
    <div v-else-if="isAssigning" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Wird zugeordnet...</span>
      </div>
      <p class="mt-3 text-muted">Armband wird zugeordnet...</p>
    </div>

    <!-- Kind wird geladen / Weiterleitung -->
    <div v-else class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Wird weitergeleitet...</span>
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
const selectedChildId = ref(null) // initial null statt leerer String

onMounted(async () => {
  await checkBraceletStatus()
})

/**
 * Prüft den Status des Armbands
 */
async function checkBraceletStatus() {
  try {
    isLoading.value = true
    error.value = null

    // Status des Armbands abfragen
    const status = await armbandComposable.getBraceletStatus(bandId.value)

    if (status) {
      // Armband ist bereits zugeordnet -> Daten setzen und weiterleiten
      childData.value = status
      console.log(`✅ Armband ${bandId.value} ist bereits dem Kind ${status.name} zugeordnet`)

      // Weiterleitung zur Kind-Detailseite
      await router.push({ name: 'ChildDetail', params: { id: status.id } })
    } else {
      // Nicht zugeordnet -> Kinder der Gruppe laden
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
 * Lädt die Kinder der aktuellen Gruppe
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
 * Weist das Armband dem ausgewählten Kind zu
 */
async function assignArmband() {
  try {
    if (!selectedChildId.value) {
      error.value = 'Bitte wählen Sie ein Kind aus'
      return
    }

    isAssigning.value = true
    error.value = null

    // Armband zuordnen
    const updatedChild = await armbandComposable.assignBraceletToChild(
        selectedChildId.value,
        bandId.value
    )

    console.log('✅ Armband erfolgreich zugeordnet. Weiterleitung zur Kinderseite...')

    // Weiterleitung zur Kind-Detailseite
    await router.push({ name: 'ChildDetail', params: { id: updatedChild.id } })
  } catch (err) {
    console.error('Fehler beim Zuordnen des Armbands:', err)
    error.value = err.message || 'Fehler beim Zuordnen des Armbands'
    isAssigning.value = false
  }
}

/**
 * Zurück navigieren
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