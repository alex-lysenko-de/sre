<!-- src/views/ScannerBusView.vue -->
<!-- Modus "Bus zählen" (tickets/120/120.txt, BUS). Zaehlt Kinder im Bus des
     aktuellen Nutzers, sammelt ein PresencePacket (useScanPacket) und sendet
     es per "Senden" an submit-scan-packet. Reine Wiederverwendung von
     Scanner.vue (Kamera/Decode/Bracelet-Resolve, unveraendert seit Ticket 116). -->

<template>
  <div class="scan-mode-view">
    <Scanner ref="scannerRef" :on-child-resolved="handleResolved" :on-bind-requested="onBindRequested"/>

    <div class="mode-panel">
      <h5 class="mode-title">Bus zählen — Bus {{ userStore.userInfo.bus_id }}</h5>

      <div class="mode-counter">
        Gescannt: <strong>{{ scannedList.length }}</strong>
      </div>

      <div v-if="lastFound" class="mode-last-found">
        <span class="mode-last-found-label">Letztes Kind:</span>
        <span class="badge bg-success">
          <font-awesome-icon :icon="['fas', 'check']"/>
          {{ lastFound.name }}
        </span>
      </div>

      <div class="mode-actions">
        <button class="btn btn-secondary" :disabled="isSending" @click="handleClose">
          Schließen
        </button>
        <button class="btn btn-success" :disabled="scannedList.length === 0 || isSending" @click="handleSend">
          Senden
        </button>
      </div>

      <ul v-if="scannedList.length > 0" class="mode-scanned-list">
        <li v-for="entry in scannedList" :key="entry.child_id">
          {{ entry.name }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import Scanner from '@/components/scanner/Scanner.vue'
import { useUserStore } from '@/stores/user'
import { useScanPacket } from '@/composables/useScanPacket'

const router = useRouter()
const userStore = useUserStore()
const scanPacket = useScanPacket()

const scannerRef = ref(null)
const isSending = ref(false)
const lastFound = ref(null)

// Anzeige-Liste "in diesem Durchgang gescannt" - getrennt vom Paket
// (scanPacket.packet.children enthaelt nur child_id/timestamp/method fuer den
// Versand), analog zum Muster aus ScannerPrototypeView.vue (Ticket 116).
const scannedList = reactive([])

scanPacket.createPacket('BUS', { bus_id: userStore.userInfo.bus_id })

const handleResolved = async (result) => {
  if (result.status !== 'found') {
    return undefined // Scanner zeigt den Standardbildschirm für invalid/not-found/error selbst.
  }

  const child = result.child

  if (scanPacket.isDuplicate(child.id)) {
    return { title: 'Bereits erfasst', subtitle: child.name, variant: 'success', repeat: true }
  }

  scanPacket.addScanned(child)
  lastFound.value = child
  scannedList.push({ child_id: child.id, name: child.name })

  return undefined // Scanner zeigt den Standard-Erfolgsbildschirm (Name des Kindes).
}

const handleReset = () => {
  scanPacket.resetPacket()
  scannedList.splice(0, scannedList.length)
  lastFound.value = null
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
      subtitle: `${scannedList.length} Kinder übermittelt`
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
  font-size: 0.95rem;
  margin-bottom: 10px;
}

.mode-last-found {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.mode-last-found .badge {
  font-size: 1rem;
  padding: 8px 12px;
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

.mode-scanned-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  max-height: 250px;
  overflow-y: auto;
}

.mode-scanned-list li {
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 6px;
}
</style>
