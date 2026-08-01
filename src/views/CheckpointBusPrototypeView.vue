<!-- src/views/CheckpointBusPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Bus-Checkpoint,
     ausschliesslich Mock-Daten. Raster orientiert sich visuell an
     AdminBusView.vue/BusDetailModal.vue (nicht wiederverwendet als Code,
     siehe tickets/130_2/IMPLEMENTATION_PLAN.md, "Anализ").

     UX-Feedback Runde 1:
     - EL1: mehrzeilige Kopfzeile statt einzeiliger Ueberschrift.
     - EL2: "Cancel" ersetzt durch Schliessen/Oeffnen (reopenCheckpoint) und
       Entfernen (removeCheckpoint, mit Bestaetigung).

     UX-Feedback Runde 2:
     - EL1/EL2: Status und Schliessen/Oeffnen stehen jetzt nebeneinander in
       einer Zeile statt als grosse, vollbreite Buttons; Entfernen ist ein
       kleiner Icon-Button neben dem Titel statt eines grossen Buttons.

     UX-Feedback Runde 3:
     - EL2: zeigt jetzt zusaetzlich das Ergebnis (Kinder-/Betreuersumme) und
       die Abweichung zur Tagesbasis direkt neben Status/Aktion.
     - Schliessen warnt jetzt vorher, falls Busse noch keine Daten gemeldet
       haben (checkpointHasOpenIssues()).

     UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung):
     - Das Bus-Kartenraster (EL3) zeigt Kinder-/Betreuerzahl jetzt als
       CountLink (fuehrt zur universellen Liste, EntityListPrototypeView.vue)
       statt als inline aufklappendes Detailpanel - Kind-/Betreuernamen
       haben jetzt eine eigene Karte/Route (siehe ChildLink/BetreuerLink)
       und werden nicht mehr redundant hier dargestellt. Das Scan-Log je Bus
       (Packets) ist keine cross-cutting Entitaet und bleibt als kleines,
       aufklappbares Inline-Element auf der Karte.
     - Die vormals separate "Kinder gesamt"-Breakdown-Karte mit
       Kopieren-Buttons ist durch drei CountLinks ersetzt (Anwesend/Fehlend/
       Betreuer gesamt) - das Kopieren selbst lebt jetzt einen Klick entfernt
       in der universellen Liste (EntityListCard.vue), nicht mehr inline auf
       dieser Seite. -->
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

        <div v-if="resultSummary" class="cp-result-row">
          <CountLink :count="resultSummary.kinder" label="Kinder" :icon="['fas', 'child']" variant="kinder" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'present' })" />
          <CountLink :count="resultSummary.betreuer" label="Betreuer" :icon="['fas', 'user']" variant="betreuer" @click="openList({ kind: 'betreuer', scope: 'checkpoint' })" />
          <template v-if="!resultSummary.isBaselineCheckpoint && (resultSummary.missing > 0 || resultSummary.extra > 0)">
            <CountLink v-if="resultSummary.missing > 0" :count="resultSummary.missing" label="fehlen" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'missing' })" />
            <CountLink v-if="resultSummary.extra > 0" :count="resultSummary.extra" label="mehr" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'extra' })" />
          </template>
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
      <div class="card mb-3">
        <div class="card-body">
          <h5 class="card-title">Kinder &amp; Betreuer gesamt</h5>
          <div class="cp-aggregate-row">
            <CountLink :count="breakdownCounts.present" label="Anwesend" :icon="['fas', 'child']" variant="kinder" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'present' })" />
            <CountLink :count="breakdownCounts.absent" label="Fehlend" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'absent' })" />
            <CountLink :count="breakdownCounts.betreuer" label="Betreuer" :icon="['fas', 'user']" variant="betreuer" @click="openList({ kind: 'betreuer', scope: 'checkpoint' })" />
          </div>
        </div>
      </div>

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
                <div v-if="bus.hasData" class="cp-bus-stats" @click.stop>
                  <CountLink :count="bus.kinderCount" label="Kinder" :icon="['fas', 'child']" variant="kinder" @click="openList({ kind: 'child', scope: 'bus', scopeId: bus.busNumber })" />
                  <CountLink :count="bus.betreuerCount" label="Betreuer" :icon="['fas', 'user']" variant="betreuer" @click="openList({ kind: 'betreuer', scope: 'bus', scopeId: bus.busNumber })" />
                  <template v-if="busDelta(bus).hasComparison && (busDelta(bus).missingCount > 0 || busDelta(bus).extraCount > 0)">
                    <CountLink v-if="busDelta(bus).missingCount > 0" :count="busDelta(bus).missingCount" label="fehlen" variant="warning" @click="openList({ kind: 'child', scope: 'bus', scopeId: bus.busNumber, filter: 'missing' })" />
                    <CountLink v-if="busDelta(bus).extraCount > 0" :count="busDelta(bus).extraCount" label="mehr" variant="warning" @click="openList({ kind: 'child', scope: 'bus', scopeId: bus.busNumber, filter: 'extra' })" />
                  </template>
                </div>
                <div v-else class="cp-bus-status-text">Keine Kinder zugeordnet</div>
              </div>

              <div v-if="expandedBusNumber === bus.busNumber && bus.hasData" class="cp-expand-panel" @click.stop>
                <div class="fw-bold mb-1">Scans</div>
                <div class="cp-scroll-list">
                  <div v-for="packet in bus.packets" :key="packet.id">
                    {{ formatTime(packet.receivedAt) }} — {{ packet.authorName }} ({{ packet.childrenCount }} Kinder)
                  </div>
                </div>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CHECKPOINT_STATUS,
  fetchCheckpointDetail,
  finishCheckpoint,
  reopenCheckpoint,
  removeCheckpoint,
  summarizeCheckpoint,
  checkpointHasOpenIssues,
  getBusDelta,
  getBusChildrenBreakdown,
  getCheckpointBetreuerList
} from '@/composables/useCheckpointsMock'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import CountLink from '@/components/checkpoints-prototype/CountLink.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const resultSummary = ref(null)
const expandedBusNumber = ref(null)
const actionError = ref(null)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toggleExpand(bus) {
  expandedBusNumber.value = expandedBusNumber.value === bus.busNumber ? null : bus.busNumber
}

function busDelta(bus) {
  return getBusDelta(checkpoint.value, bus.busNumber)
}

const breakdownCounts = computed(() => {
  if (!checkpoint.value) return { present: 0, absent: 0, betreuer: 0 }
  const breakdown = getBusChildrenBreakdown(checkpoint.value)
  return {
    present: breakdown.present.length,
    absent: breakdown.absent.length,
    betreuer: getCheckpointBetreuerList(checkpoint.value).length
  }
})

function openList({ kind, scope, scopeId, filter }) {
  const query = { kind, scope, checkpointId: String(checkpoint.value.id) }
  if (scopeId != null) query.scopeId = String(scopeId)
  if (filter) query.filter = filter
  router.push({ path: '/admin/checkpoints-prototype/list', query })
}

async function load() {
  loading.value = true
  checkpoint.value = await fetchCheckpointDetail(Number(route.params.id))
  resultSummary.value = checkpoint.value ? await summarizeCheckpoint(checkpoint.value) : null
  loading.value = false
}

async function onFinish() {
  actionError.value = null
  const issues = await checkpointHasOpenIssues(checkpoint.value)
  if (issues.hasIssues && !confirm(`${issues.message} Trotzdem schließen?`)) {
    return
  }
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

.cp-result-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin: 4px 0 8px;
}

.cp-aggregate-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
}

.cp-bus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 4px;
}

.cp-bus-card-expanded .cp-bus-stats {
  justify-content: flex-start;
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
</style>
