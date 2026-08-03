<!-- src/views/ScannerCheckinView.vue -->
<!-- Modus "Freie Meldung" (tickets/120/120.txt, CHECKIN). Keine Filterung nach
     Gruppe - jedes Kind darf hier erfasst werden (120.txt, "Важные нюансы":
     BUS/CHECKIN duerfen keinen Gruppenfilter uebernehmen). Kein Roster, keine
     manuelle Markierung - strukturell am naechsten zu ScannerBusView.vue, aber
     die Liste zeigt zusaetzlich die Gruppe jedes Kindes und steht direkt unter
     dem Zaehler statt unter den Buttons. -->

<template>
  <div class="scan-mode-view">
    <Scanner ref="scannerRef" :on-child-resolved="handleResolved" :on-bind-requested="onBindRequested"/>

    <div class="mode-panel">
      <h5 class="mode-title">Freie Meldung</h5>

      <div class="mode-counter">
        Gescannt: <strong>{{ scannedList.length }}</strong>
      </div>

      <ul v-if="scannedList.length > 0" class="mode-scanned-list">
        <li v-for="entry in scannedList" :key="entry.child_id">
          <font-awesome-icon :icon="['fas', 'check']" class="text-success me-2"/>
          {{ entry.name }}
          <span class="badge bg-primary ms-2">Gruppe {{ entry.group_id }}</span>
        </li>
      </ul>

      <div class="mode-actions">
        <button class="btn btn-secondary" :disabled="isSending" @click="handleClose">
          Schließen
        </button>
        <button class="btn btn-success" :disabled="scannedList.length === 0 || isSending" @click="handleSend">
          Senden
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import Scanner from '@/components/scanner/Scanner.vue'
import { useScanPacket } from '@/composables/useScanPacket'

const router = useRouter()
const scanPacket = useScanPacket()

const scannerRef = ref(null)
const isSending = ref(false)

// Anzeige-Liste "in diesem Durchgang gescannt" - getrennt vom Paket
// (scanPacket.packet.children enthaelt nur child_id/timestamp/method fuer den
// Versand), analog zum Muster aus ScannerPrototypeView.vue (Ticket 116).
const scannedList = reactive([])

scanPacket.createPacket('CHECKIN', {})

const handleResolved = async (result) => {
  if (result.status !== 'found') {
    return undefined // Scanner zeigt den Standardbildschirm für invalid/not-found/error selbst.
  }

  const child = result.child

  if (scanPacket.isDuplicate(child.id)) {
    return { title: 'Bereits erfasst', subtitle: child.name, variant: 'success', repeat: true }
  }

  scanPacket.addScanned(child)
  scannedList.push({ child_id: child.id, name: child.name, group_id: child.group_id })

  return undefined // Scanner zeigt den Standard-Erfolgsbildschirm (Name des Kindes).
}

const handleReset = () => {
  scanPacket.resetPacket()
  scannedList.splice(0, scannedList.length)
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

.mode-scanned-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  max-height: 250px;
  overflow-y: auto;
}

.mode-scanned-list li {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 6px;
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
