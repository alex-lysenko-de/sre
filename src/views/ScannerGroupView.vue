<!-- src/views/ScannerGroupView.vue -->
<!-- Modus "Gruppen-Appell" (tickets/120/120.txt, GROUP). Laedt das Roster der
     Gruppe vorab (order by id), zeigt Checkliste gefunden/nicht gefunden,
     erlaubt manuelle Markierung per Tap (method: 'MANUAL'). Ein gescanntes
     Kind, das nicht zur aktuellen Gruppe gehoert, ist laut Definition of Done
     (tickets/120/120.txt) ein Fehler der Geschaeftslogik - nicht des Scans:
     das Kind wird nicht ins Paket aufgenommen, stattdessen erscheint eine
     eigene Meldung ("Kind gehört nicht zu dieser Gruppe").

     Bekannte Einschraenkung (Review 120, Major 1): Scanner.vue spielt den
     Erfolgston/die Vibration bereits bei status 'found' ab, also bevor
     onChildResolved aufgerufen wird - der Ton kann daher nicht mehr auf
     'variant: error' reagieren. Dieser Fall (erfolgreicher Scan, aber
     Geschaeftslogik-Fehler) existierte vor Ticket 120 nicht; Scanner.vue
     bleibt laut Plan in diesem Ticket unveraendert. Bewusst akzeptiertes
     Risiko - eine Erweiterung des Scanner.vue-Kontrakts (z.B. Ton an das
     Ergebnis von onChildResolved statt an den Resolve-Status zu knuepfen)
     waere ein separates Ticket. -->

<template>
  <div class="scan-mode-view">
    <Scanner ref="scannerRef" :on-child-resolved="handleResolved" :on-bind-requested="onBindRequested"/>

    <div class="mode-panel">
      <h5 class="mode-title">Gruppen-Appell — Gruppe {{ groupId }}</h5>

      <div class="mode-counter">
        <strong>{{ foundCount }} / {{ roster.length }}</strong>
      </div>

      <div v-if="loadingRoster" class="text-center py-3">
        <div class="spinner-border spinner-border-sm" role="status"></div>
        <span class="ms-2">Roster wird geladen...</span>
      </div>

      <div v-else-if="loadError" class="alert alert-danger">
        <div>{{ loadError }}</div>
        <button class="btn btn-sm btn-outline-danger mt-2" @click="loadRoster">
          Erneut versuchen
        </button>
      </div>

      <ul v-else class="mode-roster-list">
        <li
            v-for="child in roster"
            :key="child.id"
            class="mode-roster-item"
            :class="{ found: child.found }"
            @click="markManual(child)"
        >
          <span class="mode-roster-mark">{{ child.found ? '✓' : '□' }}</span>
          {{ child.name }}
        </li>
      </ul>

      <div class="mode-actions">
        <button class="btn btn-secondary" :disabled="isSending" @click="handleClose">
          Schließen
        </button>
        <button class="btn btn-success" :disabled="foundCount === 0 || isSending" @click="handleSend">
          Senden
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Scanner from '@/components/scanner/Scanner.vue'
import { useUserStore } from '@/stores/user'
import { useArmband } from '@/composables/useArmband'
import { useScanPacket } from '@/composables/useScanPacket'

const router = useRouter()
const userStore = useUserStore()
const armband = useArmband()
const scanPacket = useScanPacket()

const groupId = userStore.userInfo.group_id

const scannerRef = ref(null)
const isSending = ref(false)
const loadingRoster = ref(true)
const loadError = ref('')

// Roster-Eintrag: { id, name, band_id, found }
const roster = reactive([])

const foundCount = computed(() => roster.filter(child => child.found).length)

scanPacket.createPacket('GROUP', { group_id: groupId })

const loadRoster = async () => {
  loadingRoster.value = true
  loadError.value = ''
  try {
    const children = await armband.getChildrenByGroupOrderedById(groupId)
    roster.splice(0, roster.length, ...children.map(child => ({ ...child, found: false })))
  } catch (error) {
    console.error('❌ Fehler beim Laden des Rosters:', error)
    loadError.value = 'Fehler beim Laden der Gruppe. Bitte erneut versuchen.'
  } finally {
    loadingRoster.value = false
  }
}

const markRosterFound = (childId) => {
  const entry = roster.find(child => child.id === childId)
  if (entry) {
    entry.found = true
  }
}

const handleResolved = async (result) => {
  if (result.status !== 'found') {
    return undefined // Scanner zeigt den Standardbildschirm für invalid/not-found/error selbst.
  }

  const child = result.child

  if (child.group_id !== groupId) {
    // Geschaeftslogik-Fehler, kein Scan-Fehler (120.txt, Definition of Done):
    // das Kind wird nicht ins Paket aufgenommen.
    return {
      title: 'Kind gehört nicht zu dieser Gruppe',
      subtitle: child.name,
      variant: 'error'
    }
  }

  if (scanPacket.isDuplicate(child.id)) {
    return { title: 'Bereits erfasst', subtitle: child.name, variant: 'success', repeat: true }
  }

  scanPacket.addScanned(child)
  markRosterFound(child.id)

  return undefined // Scanner zeigt den Standard-Erfolgsbildschirm (Name des Kindes).
}

const markManual = (child) => {
  if (child.found) {
    return
  }
  scanPacket.addManual({ id: child.id, name: child.name })
  markRosterFound(child.id)
}

const handleReset = () => {
  scanPacket.resetPacket()
  roster.forEach(child => { child.found = false })
}

// Beendet den Modus ohne Versand (tickets/126/126.txt Punkt 6) - Navigation
// explizit statt router.back(), da dieser Screen nicht nur von /main erreicht
// werden kann.
const handleClose = () => {
  router.push('/main')
}

// Nicht-verbundenes Armband -> Zuordnung anbieten (tickets/126/126.txt Punkt 7):
// Session ohne Versand beenden, dann zum bestehenden Zuordnungs-Screen.
const onBindRequested = (bandId) => {
  handleReset()
  router.push({ name: 'Armband', params: { id: bandId } })
}

const handleSend = async () => {
  if (isSending.value) {
    return
  }
  isSending.value = true
  try {
    await scanPacket.submitPacket()
    await scannerRef.value?.showMessage('success', {
      title: 'Gesendet',
      subtitle: `${foundCount.value} Kinder übermittelt`
    })
    handleReset()
  } catch (error) {
    // Paket/client_packet_id bleiben unveraendert (useScanPacket.submitPacket) -
    // "Senden" erneut klicken wiederholt denselben Request.
    await scannerRef.value?.showMessage('error', {
      title: 'Fehler beim Senden',
      subtitle: scanPacket.errorMessage.value || 'Bitte erneut versuchen.'
    })
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  loadRoster()
})
</script>

<style scoped>
.scan-mode-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.mode-panel {
  padding: 15px;
  background: #f8f9fa;
}

.mode-title {
  text-align: center;
  margin-bottom: 10px;
}

.mode-counter {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 10px;
}

.mode-roster-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  max-height: 300px;
  overflow-y: auto;
}

.mode-roster-item {
  padding: 10px 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
}

.mode-roster-item.found {
  background: #d4edda;
  font-weight: 600;
}

.mode-roster-mark {
  display: inline-block;
  width: 1.5em;
  font-weight: 700;
}

.mode-actions {
  display: flex;
  gap: 10px;
}

.mode-actions .btn {
  flex: 1;
  padding: 16px 18px;
  font-size: 1.1rem;
}
</style>
