<!-- src/views/ScannerPrototypeView.vue -->
<!-- UI-Prototyp des neuen Scanners (Ticket 116). Nicht mit ScannerView.vue/`/scanner`
     verbunden - reines Interface-Experiment vor der eigentlichen Modi-Logik (Ticket 120). -->
<!-- Sammelt Scan-Ergebnisse zu einem PresencePacket (tickets/120/120.txt), Form: GROUP.
     "Senden" ist ein Stub: kein Netzwerk-/DB-Zugriff. -->

<template>
  <div class="scanner-prototype-view">
    <Scanner ref="scannerRef" :on-child-resolved="handleResolved"/>

    <div class="proto-summary">
      <div class="proto-summary-actions">
        <button class="btn btn-secondary" @click="exit">
          <font-awesome-icon :icon="['fas', 'arrow-left']"/>
          Beenden
        </button>
        <button class="btn btn-success" :disabled="packet.children.length === 0" @click="sendStub">
          Senden
        </button>
      </div>

      <div v-if="sentMessage" class="alert alert-info mb-0 mt-2">{{ sentMessage }}</div>

      <div class="proto-summary-count mt-2">
        Gescannt in diesem Durchgang: <strong>{{ packet.children.length }}</strong>
      </div>

      <ul v-if="scannedList.length > 0" class="proto-scanned-list">
        <li v-for="entry in scannedList" :key="entry.child_id">
          {{ entry.name }}
          <span class="badge bg-primary ms-2">Gruppe {{ entry.group_id }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Scanner from '@/components/scanner/Scanner.vue'
import { useUserStore } from '@/stores/user'
import { useScannerFeedback } from '@/composables/useScannerFeedback'

const router = useRouter()
const userStore = useUserStore()
const feedback = useScannerFeedback()

const scannerRef = ref(null)
const sentMessage = ref('')

// Liste "in diesem Durchgang gescannt" - fuer die Anzeige und Duplikat-Erkennung.
const scannedList = reactive([])

// PresencePacket (tickets/120/120.txt) - Form GROUP, wird nur im Speicher gehalten.
const packet = reactive({
  type: 'GROUP',
  author_id: userStore.userInfo.id,
  group_id: userStore.userInfo.group_id,
  started_at: null,
  finished_at: null,
  children: []
})

const DUPLICATE_SOUND = { frequencies: [440, 440], duration: 0.15 }
const DUPLICATE_VIBRATION = [80]

const handleResolved = async (result) => {
  if (result.status !== 'found') {
    return undefined // Scanner zeigt den Standardbildschirm für invalid/not-found selbst.
  }

  const child = result.child
  const alreadyScanned = packet.children.some(entry => entry.child_id === child.id)

  if (alreadyScanned) {
    feedback.playTone(DUPLICATE_SOUND.frequencies, DUPLICATE_SOUND.duration)
    feedback.vibrate(DUPLICATE_VIBRATION)
    return { title: 'Bereits gescannt', subtitle: child.name, variant: 'error' }
  }

  const now = new Date().toISOString()
  if (!packet.started_at) {
    packet.started_at = now
  }
  packet.finished_at = now
  packet.children.push({ child_id: child.id, timestamp: now, method: 'SCAN' })
  scannedList.push({ child_id: child.id, name: child.name, group_id: child.group_id })

  return undefined // Scanner zeigt den Standard-Erfolgsbildschirm (Name des Kindes).
}

const sendStub = () => {
  // Bewusster Stub (116.txt, "Was nicht in dieses Ticket gehört"): kein Netzwerk-/DB-Aufruf.
  packet.finished_at = new Date().toISOString()
  sentMessage.value = 'Gesendet (Simulation) – es wurde nichts an den Server übertragen.'
}

const exit = async () => {
  await scannerRef.value?.stop()
  router.push('/main')
}
</script>

<style scoped>
.scanner-prototype-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.proto-summary {
  padding: 15px;
  background: #f8f9fa;
}

.proto-summary-actions {
  display: flex;
  gap: 10px;
}

.proto-summary-actions .btn {
  flex: 1;
}

.proto-summary-count {
  text-align: center;
  font-size: 0.95rem;
}

.proto-scanned-list {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  max-height: 250px;
  overflow-y: auto;
}

.proto-scanned-list li {
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
}
</style>
