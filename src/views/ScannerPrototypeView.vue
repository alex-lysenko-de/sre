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
        <button class="btn btn-success" :disabled="packet.children.length === 0 || isSending" @click="sendStub">
          Senden
        </button>
      </div>

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

const router = useRouter()
const userStore = useUserStore()

const scannerRef = ref(null)
const isSending = ref(false)

// Liste "in diesem Durchgang gescannt" - fuer die Anzeige und Duplikat-Erkennung.
const scannedList = reactive([])

// PresencePacket (tickets/120/120.txt) - Form GROUP, wird nur im Speicher gehalten.
// group_id stammt aus userInfo.group_id ("Gruppe heute", siehe CLAUDE.md) und kann
// null sein, wenn dem Nutzer heute keine Gruppe zugewiesen ist - fuer den Prototyp
// unkritisch (Paket wird nirgends versendet), aber nicht ungeprueft nach 120 uebernehmen.
const packet = reactive({
  type: 'GROUP',
  author_id: userStore.userInfo.id,
  group_id: userStore.userInfo.group_id,
  started_at: null,
  finished_at: null,
  children: []
})

const resetRound = () => {
  packet.started_at = null
  packet.finished_at = null
  packet.children.splice(0, packet.children.length)
  scannedList.splice(0, scannedList.length)
}

const handleResolved = async (result) => {
  if (result.status !== 'found') {
    return undefined // Scanner zeigt den Standardbildschirm für invalid/not-found/error selbst.
  }

  const child = result.child
  const alreadyScanned = packet.children.some(entry => entry.child_id === child.id)

  if (alreadyScanned) {
    // Laut manuellem Test (REVIEW_REPORT.md) ist ein Wiederholungsscan kein Fehler:
    // gruener Erfolgsbildschirm + Standard-Erfolgston (in Scanner.vue bereits
    // ausgeloest), nur mit Hinweistext und zusaetzlicher "doppelt"-Markierung.
    return { title: 'Bereits erfasst', subtitle: child.name, variant: 'success', repeat: true }
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

const sendStub = async () => {
  if (isSending.value) {
    return
  }
  isSending.value = true
  try {
    // Bewusster Stub (116.txt, "Was nicht in dieses Ticket gehört"): kein Netzwerk-/DB-Aufruf.
    packet.finished_at = new Date().toISOString()
    await scannerRef.value?.showMessage('success', {
      title: 'Gesendet',
      subtitle: 'Simulation – es wurde nichts an den Server übertragen.'
    })
    resetRound()
  } catch (error) {
    console.error('❌ Fehler beim Senden (Stub):', error)
    await scannerRef.value?.showMessage('error', {
      title: 'Fehler beim Senden',
      subtitle: 'Bitte erneut versuchen.'
    })
  } finally {
    isSending.value = false
  }
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
  padding: 16px 18px;
  font-size: 1.1rem;
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
