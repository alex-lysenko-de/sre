<!-- src/views/CheckpointBusPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Bus-Checkpoint,
     ausschliesslich Mock-Daten. Raster orientiert sich visuell an
     AdminBusView.vue/BusDetailModal.vue (nicht wiederverwendet als Code,
     siehe tickets/130_2/IMPLEMENTATION_PLAN.md, "Anализ").

     UX-Feedback Runde 1:
     - EL1: mehrzeilige Kopfzeile statt einzeiliger Ueberschrift.
     - EL2: "Cancel" ersetzt durch Schliessen/Oeffnen (reopenCheckpoint) und
       Entfernen (removeCheckpoint, mit Bestaetigung).
     - EL3: Tabelle durch Kartenraster ersetzt; ein Bus kann > 8 Betreuer
       haben (Bus 1 demonstriert das) - Details (Betreuer/Kinder/Scanzeiten)
       stehen daher nicht mehr direkt in der Karte, sondern im Detailpanel.
     - EL4: Detailpanel mit Betreuer-/Kinderliste und Scanzeiten je Bus,
       inkl. "Kopieren"-Button (Text in die Zwischenablage).

     UX-Feedback Runde 2:
     - EL1/EL2: Status und Schliessen/Oeffnen stehen jetzt nebeneinander in
       einer Zeile statt als grosse, vollbreite Buttons; Entfernen ist ein
       kleiner Icon-Button neben dem Titel statt eines grossen Buttons.
     - EL3/EL4: Kinder-/Betreuerzahl farblich unterschieden (blau/rot) und
       vergroessert; das Detailpanel (EL4) klappt jetzt direkt innerhalb der
       angeklickten Bus-Karte auf (per grid-column: 1 / -1), statt als
       eigener Block unterhalb des gesamten Rasters zu erscheinen. Kinder
       zeigen jetzt ihre Gruppennummer, um Namensverwechslungen zu
       vermeiden. -->
<template>
  <div class="cp-detail-view">
    <DebugTag variant="page" label="Page 2" />

    <div class="cp-header">
      <DebugTag label="el1" />
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">Bus Checkpoint #{{ checkpoint?.seq }}</span>
        <button v-if="checkpoint" class="cp-remove-btn" title="Entfernen" @click="onRemove">
          <font-awesome-icon :icon="['fas', 'trash-alt']" />
        </button>
      </div>

      <template v-if="checkpoint">
        <div class="cp-status-row">
          <DebugTag label="el2" />
          <CheckpointStatusBadge :status="checkpoint.status" :day="checkpoint.day" />
          <button
              v-if="checkpoint.status === OPEN"
              class="btn btn-success cp-toggle-btn"
              @click="onFinish"
          >
            <font-awesome-icon :icon="['fas', 'check-circle']" class="me-1" />
            Schließen
          </button>
          <button
              v-else
              class="btn btn-primary cp-toggle-btn"
              @click="onReopen"
          >
            <font-awesome-icon :icon="['fas', 'redo']" class="me-1" />
            Öffnen
          </button>
        </div>

        <div v-if="actionError" class="alert alert-danger py-2">
          <template v-if="actionError.error === 'ALREADY_OPEN'">
            Es ist bereits ein anderer Bus-Checkpoint offen (#{{ actionError.existingId }}). Zuerst diesen schließen.
          </template>
        </div>

        <div class="cp-header-line">
          <CheckpointOriginBadge :created-by="checkpoint.created_by" />
        </div>
      </template>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="checkpoint">
      <div class="card">
        <div class="card-body">
          <DebugTag label="el3" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'bus']" class="me-2" />
            Busse
          </h5>

          <div class="cp-bus-grid">
            <div
                v-for="bus in checkpoint.buses"
                :key="bus.busNumber"
                class="cp-bus-card"
                :class="[bus.hasData ? 'cp-bus-card-ok' : 'cp-bus-card-none', expandedBusNumber === bus.busNumber ? 'cp-bus-card-expanded' : '']"
                role="button"
                @click="toggleExpand(bus)"
            >
              <div class="cp-bus-card-summary">
                <div class="cp-bus-num">Bus {{ bus.busNumber }}</div>
                <div v-if="bus.hasData" class="cp-bus-stats">
                  <span class="cp-bus-stat-kinder">
                    <font-awesome-icon :icon="['fas', 'child']" /> {{ bus.kinderCount }}
                  </span>
                  <span class="cp-bus-stat-betreuer">
                    <font-awesome-icon :icon="['fas', 'user']" /> {{ bus.betreuerCount }}
                  </span>
                </div>
                <div v-else class="cp-bus-status-text">Keine Kinder zugeordnet</div>
              </div>

              <div v-if="expandedBusNumber === bus.busNumber" class="cp-expand-panel" @click.stop>
                <DebugTag label="el4" />
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div class="fw-bold">Bus {{ bus.busNumber }}</div>
                  <button class="btn btn-secondary btn-sm" @click="copyBusSummary(bus)">
                    {{ copied ? 'Kopiert!' : 'Kopieren' }}
                  </button>
                </div>

                <template v-if="bus.hasData">
                  <div class="mb-2">
                    <div class="fw-bold">Betreuer ({{ bus.betreuerNames.length }})</div>
                    <div class="cp-scroll-list">
                      <div v-for="(name, idx) in bus.betreuerNames" :key="idx">{{ name }}</div>
                    </div>
                  </div>
                  <div class="mb-2">
                    <div class="fw-bold">Kinder ({{ bus.children.length }})</div>
                    <div class="cp-scroll-list">
                      <div v-for="(child, idx) in bus.children" :key="idx">
                        {{ child.name }} <span class="cp-child-group-tag">G-{{ child.groupId }}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div class="fw-bold">Scans</div>
                    <div class="cp-scroll-list">
                      <div v-for="packet in bus.packets" :key="packet.id">
                        {{ formatTime(packet.receivedAt) }} — {{ packet.authorName }} ({{ packet.childrenCount }} Kinder)
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="text-muted">Keine Kinder zugeordnet.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="alert alert-danger">Checkpoint nicht gefunden.</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CHECKPOINT_STATUS,
  fetchCheckpointDetail,
  finishCheckpoint,
  reopenCheckpoint,
  removeCheckpoint
} from '@/composables/useCheckpointsMock'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const expandedBusNumber = ref(null)
const actionError = ref(null)
const copied = ref(false)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toggleExpand(bus) {
  expandedBusNumber.value = expandedBusNumber.value === bus.busNumber ? null : bus.busNumber
  copied.value = false
}

async function copyBusSummary(bus) {
  const lines = [
    `Bus ${bus.busNumber}`,
    `Kinder: ${bus.kinderCount}`,
    `Betreuer: ${bus.betreuerCount}`,
    ...bus.betreuerNames.map(name => `- ${name}`),
    '',
    'Kinder:',
    ...bus.children.map(c => `- ${c.name} (G-${c.groupId})`),
    '',
    'Scans:',
    ...bus.packets.map(p => `${formatTime(p.receivedAt)} - ${p.authorName} (${p.childrenCount} Kinder)`)
  ]

  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
  } catch (err) {
    console.error('Fehler beim Kopieren:', err)
  }
}

async function load() {
  loading.value = true
  checkpoint.value = await fetchCheckpointDetail(Number(route.params.id))
  loading.value = false
}

async function onFinish() {
  actionError.value = null
  await finishCheckpoint(checkpoint.value.id)
  await load()
}

async function onReopen() {
  actionError.value = null
  const result = await reopenCheckpoint(checkpoint.value.id)
  if (result?.error) {
    actionError.value = result
    return
  }
  await load()
}

async function onRemove() {
  if (!confirm('Diesen Checkpoint wirklich entfernen? Das kann nicht rückgängig gemacht werden.')) {
    return
  }
  await removeCheckpoint(checkpoint.value.id)
  goBack()
}

function goBack() {
  router.push('/admin/checkpoints-prototype')
}

onMounted(load)
</script>

<style scoped>
.cp-detail-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
}

.cp-header {
  margin-bottom: 8px;
}

.cp-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.cp-header-title {
  font-size: 1.4rem;
  font-weight: 700;
  flex: 1;
}

.cp-header-line {
  margin-bottom: 6px;
}

.cp-back-btn {
  border: none;
  border-radius: 8px;
  background-color: #e9ecef;
  color: #495057;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}

.cp-remove-btn {
  margin-left: auto;
  border: none;
  border-radius: 8px;
  background-color: #f8d7da;
  color: #842029;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 8px 0;
}

.cp-toggle-btn {
  min-height: 44px;
  font-size: 1rem;
  font-weight: 700;
  padding: 8px 18px;
}

.cp-bus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.cp-bus-card {
  border-radius: 12px;
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
}

.cp-bus-card-expanded {
  grid-column: 1 / -1;
  text-align: left;
}

.cp-bus-num {
  font-size: 1.2rem;
  font-weight: 700;
}

.cp-bus-stats {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 4px;
}

.cp-bus-card-expanded .cp-bus-stats {
  justify-content: flex-start;
}

.cp-bus-stat-kinder {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0d6efd;
}

.cp-bus-stat-betreuer {
  font-size: 1.4rem;
  font-weight: 800;
  color: #dc3545;
}

.cp-bus-status-text {
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 4px;
}

.cp-bus-card-ok {
  background-color: #d1e7dd;
  color: #0f5132;
}

.cp-bus-card-none {
  background-color: #e9ecef;
  color: #495057;
}

.cp-expand-panel {
  margin-top: 12px;
  padding: 14px;
  border-radius: 12px;
  background-color: #fff3cd;
  font-size: 1.05rem;
  color: #212529;
  cursor: default;
}

.cp-scroll-list {
  max-height: 160px;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  padding: 8px 10px;
  user-select: text;
}

.cp-child-group-tag {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #495057;
  background-color: #e9ecef;
  border-radius: 6px;
  padding: 1px 6px;
  margin-left: 4px;
}
</style>
