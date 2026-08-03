<!-- src/views/CheckpointBusView.vue -->
<!-- Ticket 134 - reales Pendant zu CheckpointBusPrototypeView.vue: Detail-/
     Monitoring-Bildschirm einer Bus-Checkpoint auf echten Daten
     (useCheckpoints.js, Ticket 133), mit Realtime statt manuellem
     "Aktualisieren".

     Abweichung vom Prototyp: getBusChildrenBreakdown()/getBusDelta() sind in
     der realen useCheckpoints.js async (tickets/133/133.txt, Kopfkommentar
     "Abweichung von der Mock-Signatur") - anders als im Prototyp koennen sie
     nicht mehr als synchrone computed()-Werte berechnet werden, sondern
     werden einmalig nach load() in refs abgelegt (breakdownCounts,
     busDeltas). -->
<template>
  <div class="cp-detail-view">
    <div class="cp-header">
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
                  <template v-if="busDeltas[bus.busNumber]?.hasComparison && (busDeltas[bus.busNumber].missingCount > 0 || busDeltas[bus.busNumber].extraCount > 0)">
                    <CountLink v-if="busDeltas[bus.busNumber].missingCount > 0" :count="busDeltas[bus.busNumber].missingCount" label="fehlen" variant="warning" @click="openList({ kind: 'child', scope: 'bus', scopeId: bus.busNumber, filter: 'missing' })" />
                    <CountLink v-if="busDeltas[bus.busNumber].extraCount > 0" :count="busDeltas[bus.busNumber].extraCount" label="mehr" variant="warning" @click="openList({ kind: 'child', scope: 'bus', scopeId: bus.busNumber, filter: 'extra' })" />
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
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
} from '@/composables/useCheckpoints'
import CheckpointStatusBadge from '@/components/checkpoints/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints/CheckpointOriginBadge.vue'
import CountLink from '@/components/checkpoints/CountLink.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const resultSummary = ref(null)
const expandedBusNumber = ref(null)
const actionError = ref(null)
const breakdownCounts = ref({ present: 0, absent: 0, betreuer: 0 })
const busDeltas = ref({})

let realtimeChannel = null
let reloadDebounceTimer = null

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toggleExpand(bus) {
  expandedBusNumber.value = expandedBusNumber.value === bus.busNumber ? null : bus.busNumber
}

function openList({ kind, scope, scopeId, filter }) {
  const query = { kind, scope, checkpointId: String(checkpoint.value.id) }
  if (scopeId != null) query.scopeId = String(scopeId)
  if (filter) query.filter = filter
  router.push({ path: '/admin/checkpoints/list', query })
}

async function load() {
  loading.value = true
  checkpoint.value = await fetchCheckpointDetail(Number(route.params.id))
  if (!checkpoint.value) {
    resultSummary.value = null
    loading.value = false
    return
  }

  const [summary, breakdown, betreuerList, deltas] = await Promise.all([
    summarizeCheckpoint(checkpoint.value),
    getBusChildrenBreakdown(checkpoint.value),
    Promise.resolve(getCheckpointBetreuerList(checkpoint.value)),
    Promise.all(checkpoint.value.buses.map(bus => getBusDelta(checkpoint.value, bus.busNumber)))
  ])

  resultSummary.value = summary
  breakdownCounts.value = {
    present: breakdown.present.length,
    absent: breakdown.absent.length,
    betreuer: betreuerList.length
  }
  busDeltas.value = Object.fromEntries(checkpoint.value.buses.map((bus, idx) => [bus.busNumber, deltas[idx]]))
  loading.value = false
}

function debouncedReload() {
  if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer)
  reloadDebounceTimer = setTimeout(load, 400)
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
  router.push('/admin/checkpoints')
}

function setupRealtimeSubscription() {
  const id = Number(route.params.id)
  realtimeChannel = supabase
      .channel(`checkpoint-bus-${id}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkpoints', filter: `id=eq.${id}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scan_packets', filter: `checkpoint_id=eq.${id}` }, debouncedReload)
      .subscribe()
}

onMounted(() => {
  load()
  setupRealtimeSubscription()
})

onUnmounted(() => {
  if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer)
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
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
