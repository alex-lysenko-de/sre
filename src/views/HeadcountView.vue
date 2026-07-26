<!-- src/views/HeadcountView.vue -->
<!-- Kopfzaehlung (tickets/123/123.txt) - dichte Tabellenansicht nach dem
     Vorbild einer Papier-Anwesenheitsliste (Konzept A, siehe
     tickets/123/IMPLEMENTATION_PLAN.md, "UI изменения"): stabile
     Reihenfolge nach id (useChildren.fetchChildrenByGroup), laufende
     Nummer, Spalten Morgens (nur Anzeige)/Jetzt (Checkbox, manuelle
     Markierung ueber setPresentNow() - unveraendert aus Ticket 106/122).
     Zusaetzlich Scan-Button + eingebettetes Scanner.vue-Panel (Punkt 7-8
     des Tickets) ueber useGroupScanSession.js. -->
<template>
  <div class="kz-view">
    <div class="kz-topbar">
      <button class="btn btn-sm btn-outline-secondary" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']"/>
      </button>
      <h6 class="kz-title">
        Kopfzählung — Gruppe {{ groupId }}
      </h6>
      <span class="kz-counter">{{ presentCount }} / {{ children.length }}</span>
    </div>

    <div v-if="loadingInitialData" class="text-center py-5">
      <div class="spinner-border mb-3" role="status">
        <span class="visually-hidden">Wird geladen...</span>
      </div>
      <p class="text-muted">Lade Kinderdaten...</p>
    </div>

    <div v-else-if="loadError" class="text-center py-5">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-danger mb-3" size="2x"/>
      <p class="text-muted">{{ loadError }}</p>
      <button class="btn btn-outline-primary" @click="loadInitialData">
        <font-awesome-icon :icon="['fas', 'redo']"/>
        Erneut versuchen
      </button>
    </div>

    <template v-else>
      <button
          v-if="!groupScanSession.isOpen.value"
          class="btn btn-primary kz-scan-btn"
          @click="groupScanSession.openPanel"
      >
        <font-awesome-icon :icon="['fas', 'qrcode']" class="me-2"/>
        Scan
      </button>

      <div v-if="groupScanSession.sendError.value" class="alert alert-danger kz-send-error py-1 px-2 d-flex justify-content-between align-items-center">
        <span>{{ groupScanSession.sendError.value }}</span>
        <button class="btn btn-sm btn-outline-danger" @click="groupScanSession.retrySend">
          Wiederholen
        </button>
      </div>

      <transition name="kz-scanner-panel">
        <div v-if="groupScanSession.isOpen.value" class="kz-scanner-panel">
          <Scanner :on-child-resolved="groupScanSession.handleResolved"/>
        </div>
      </transition>

      <div class="table-responsive kz-table-wrap">
        <table class="table table-sm kz-table mb-0">
          <thead>
          <tr>
            <th class="text-end">#</th>
            <th>Kind</th>
            <th v-if="showMorningColumn" class="text-center">Morgens</th>
            <th class="text-center">Jetzt</th>
          </tr>
          </thead>
          <tbody>
          <tr v-if="children.length === 0">
            <td :colspan="showMorningColumn ? 4 : 3" class="text-center text-muted">
              Keine Kinder in dieser Gruppe.
            </td>
          </tr>
          <tr v-for="(child, index) in children" :key="child.id" :class="{ 'bg-danger-subtle': !child.presentNow }">
            <td class="text-end">{{ index + 1 }}</td>
            <td>
              {{ child.name }}
              <div v-if="child.error" class="text-danger small">{{ child.error }}</div>
            </td>
            <td v-if="showMorningColumn" class="text-center">
              <input type="checkbox" class="form-check-input" :checked="child.presenceMorning" disabled>
            </td>
            <td class="text-center">
              <input
                  type="checkbox"
                  class="form-check-input"
                  v-model="child.presentNow"
                  :disabled="child.updating"
                  @change="onTogglePresentNow(child)"
              >
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Scanner from '@/components/scanner/Scanner.vue'
import { useChildren } from '@/composables/useChildren'
import { useChildPresence } from '@/composables/useChildPresence'
import { useGroupScanSession } from '@/composables/useGroupScanSession'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const { fetchChildrenByGroup } = useChildren()
const { getTodayGroupPresence, setPresentNow } = useChildPresence()

const groupId = ref(null)
const loadingInitialData = ref(true)
const loadError = ref(null)
const children = ref([])

const presentCount = computed(() => children.value.filter(child => child.presentNow).length)
// Punkt 5 der Anforderung: Spalte "Morgens" ausblenden, solange noch niemand
// in der Gruppe heute presence_morning=1 hat (naeherungsweise, siehe Plan/Risiken).
const showMorningColumn = computed(() => children.value.some(child => child.presenceMorning))

const groupScanSession = useGroupScanSession(groupId, children)

const loadInitialData = async () => {
  loadingInitialData.value = true
  loadError.value = null
  try {
    const [childrenList, presenceMap] = await Promise.all([
      fetchChildrenByGroup(groupId.value),
      getTodayGroupPresence(groupId.value)
    ])

    children.value = childrenList.map(child => {
      const presence = presenceMap.get(child.id)
      const presenceMorning = presence ? presence.presence_morning === 1 : false
      const presentNow = presence ? presence.presence_now === 1 : presenceMorning

      return {
        ...child,
        presenceMorning,
        presentNow,
        updating: false,
        error: null
      }
    })
  } catch (error) {
    loadError.value = `Fehler beim Laden der Kopfzählung: ${error.message}`
  } finally {
    loadingInitialData.value = false
  }
}

const onTogglePresentNow = async (child) => {
  const desired = child.presentNow
  child.updating = true
  child.error = null
  try {
    await setPresentNow(child.id, groupId.value, desired, userStore.userInfo.id)
  } catch (error) {
    child.presentNow = !desired
    child.error = `Fehler beim Speichern: ${error.message}`
  } finally {
    child.updating = false
  }
}

const goBack = () => {
  router.push('/main')
}

const init = async () => {
  if (!userStore.userInfo.user_id) {
    await userStore.loadUser()
  }
  groupId.value = userStore.userInfo.group_id

  if (!groupId.value) {
    loadingInitialData.value = false
    loadError.value = 'Ihnen ist heute keine Gruppe zugewiesen. Kopfzählung ist nicht möglich.'
    return
  }

  await loadInitialData()
}

init()
</script>

<style scoped>
.kz-view {
  padding: 8px;
  max-width: 900px;
  margin: 0 auto;
}

.kz-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.kz-title {
  flex: 1;
  margin: 0;
  font-weight: 600;
}

.kz-counter {
  font-weight: 700;
}

.kz-scan-btn {
  width: 100%;
  margin-bottom: 8px;
}

.kz-send-error {
  margin-bottom: 8px;
}

.kz-scanner-panel {
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 8px;
  border-radius: 8px;
}

.kz-scanner-panel-enter-active,
.kz-scanner-panel-leave-active {
  transition: max-height 0.3s ease;
}

.kz-scanner-panel-enter-from,
.kz-scanner-panel-leave-to {
  max-height: 0;
}

.kz-table-wrap {
  border: 1px solid #dee2e6;
  border-radius: 6px;
}

.kz-table {
  margin-bottom: 0;
}

.kz-table th,
.kz-table td {
  padding: 6px 8px;
  vertical-align: middle;
}

.kz-table input[type="checkbox"] {
  width: 1.3em;
  height: 1.3em;
}
</style>
