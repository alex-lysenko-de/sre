<!-- src/views/CheckpointListPrototypeView.vue -->
<!-- Ticket 130_2 - UI-Prototyp "Checkpoint"-Hauptbildschirm, ausschliesslich
     auf Mock-Daten (useCheckpointsMock.js). Kein Supabase-Aufruf, keine
     Realtime-Subscription - Liste/Detail teilen sich denselben
     reactive-Singleton, daher genuegt ein Neuladen nach jeder Aktion.
     Vorbild fuer die Raster ist tickets/130/IMPLEMENTATION_PLAN.md,
     "UI изменения" / "Главный экран".

     UX-Feedback Runde 1: Tabelle (EL4) durch Kartenliste ersetzt - passt
     nicht in eine Bildschirmbreite und zwingt zum Scrollen; "Erstellt von"
     ist in der Liste nicht mehr sichtbar (nur noch im Detail), Buttons/
     Schriftgroessen insgesamt vergroessert (Feldnutzung/Handschuhe/Sonne).

     UX-Feedback Runde 2 (EL4): Karte in Kopf/Inhalt/Fuss gegliedert
     (Nummer+Typ / Start-Ende-Zeit / Status+Anomalie) statt einer generischen
     zweizeiligen Karte; offene Checkpoints heben sich farblich ab, erledigte
     werden bewusst unauffaelliger dargestellt (grauer, weniger Kontrast);
     der Anomalie-Hinweis steht jetzt als eigene Zeile im Kartenfuss statt
     als zusaetzliches Badge neben dem Status.

     UX-Feedback Runde 3 (EL4): die Karte zeigte bisher kein Ergebnis, nur
     Zeiten/Status - der Kern jeder Checkpoint fehlte. Jetzt zeigt der Inhalt
     zusaetzlich das Ergebnis (BUS: Kinder/Betreuer-Summe; GROUP/LAZY:
     anwesend/gesamt), der Fuss zusaetzlich die Abweichung zur Tagesbasis
     (fehlen/mehr), sobald eine Basis existiert (siehe summarizeCheckpoint()
     in useCheckpointsMock.js). Kartenpolsterung dafuer leicht erhoeht. -->
<template>
  <div class="cp-list-view">
    <DebugTag variant="page" label="Page 1" />

    <div class="d-flex align-items-center mb-3">
      <DebugTag label="el1" />
      <button class="cp-back-btn me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <h4 class="mb-0">Checkpoints (Prototyp)</h4>
    </div>

    <!-- Gesamt-Summe (synthetisch, nicht aus useBusData/useGroups) -->
    <div class="card mb-3">
      <div class="card-body">
        <DebugTag label="el2" />
        <h5 class="mb-3 text-center">Gesamt</h5>
        <div class="row text-center">
          <div class="col-6">
            <div class="cp-big-number text-primary">{{ mockTotalKinder }}</div>
            <div class="text-muted">Kinder</div>
          </div>
          <div class="col-6">
            <div class="cp-big-number text-success">{{ mockTotalBetreuer }}</div>
            <div class="text-muted">Betreuer</div>
          </div>
        </div>
      </div>
    </div>

    <DebugTag label="el3" />
    <button class="btn btn-success w-100 mb-3 cp-btn-create" @click="showCreateModal = true">
      <font-awesome-icon :icon="['fas', 'plus']" class="me-2" />
      Neuen Checkpoint erstellen
    </button>

    <div v-if="createError" class="alert alert-danger alert-dismissible fade show" role="alert">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
      Es ist bereits ein Checkpoint dieses Typs offen (#{{ createError.existingId }}). Bitte zuerst abschliessen.
      <button type="button" class="btn-close" @click="createError = null"></button>
    </div>

    <div class="card">
      <div class="card-body">
        <DebugTag label="el4" />
        <h5 class="card-title">
          <font-awesome-icon :icon="['fas', 'chart-line']" class="me-2" />
          Checkpoints (heute)
        </h5>

        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border" role="status"></div>
        </div>

        <div v-else-if="!checkpoints.length" class="text-center py-5 text-muted">
          Noch keine Checkpoints heute.
        </div>

        <div v-else class="cp-card-list">
          <div
              v-for="cp in checkpoints"
              :key="cp.id"
              class="cp-item-card"
              :class="cp.status === FINISHED ? 'cp-item-card-closed' : 'cp-item-card-open'"
              role="button"
              @click="openDetail(cp)"
          >
            <div class="cp-item-header">
              <span class="cp-item-seq">#{{ cp.seq }}</span>
              <CheckpointTypeBadge :type="cp.type" />
            </div>
            <div class="cp-item-body">
              <div class="cp-item-time">
                {{ formatTime(cp.created_at) }}
                <template v-if="cp.finished_at"> – {{ formatTime(cp.finished_at) }}</template>
              </div>
              <div v-if="results[cp.id]" class="cp-item-result">
                <template v-if="cp.type === CHECKPOINT_TYPE.BUS">
                  <span class="cp-item-stat-kinder">
                    <font-awesome-icon :icon="['fas', 'child']" /> {{ results[cp.id].kinder }}
                  </span>
                  <span class="cp-item-stat-betreuer">
                    <font-awesome-icon :icon="['fas', 'user']" /> {{ results[cp.id].betreuer }}
                  </span>
                </template>
                <template v-else>
                  <span class="cp-item-stat-present">
                    {{ results[cp.id].present }}<template v-if="results[cp.id].total != null"> / {{ results[cp.id].total }}</template>
                  </span>
                </template>
              </div>
            </div>
            <div class="cp-item-footer">
              <CheckpointStatusBadge :status="cp.status" :day="cp.day" />
              <div
                  v-if="results[cp.id] && !results[cp.id].isBaselineCheckpoint && (results[cp.id].missing > 0 || results[cp.id].extra > 0)"
                  class="cp-item-delta"
              >
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
                <template v-if="results[cp.id].missing > 0">{{ results[cp.id].missing }} fehlen</template>
                <template v-if="results[cp.id].missing > 0 && results[cp.id].extra > 0">, </template>
                <template v-if="results[cp.id].extra > 0">{{ results[cp.id].extra }} mehr</template>
              </div>
              <div v-if="anomalousIds.has(cp.id)" class="cp-item-anomaly">
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
                Mehrere gleichzeitig offen
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CheckpointCreateModal
        :show="showCreateModal"
        :open-types="openTypes"
        @close="showCreateModal = false"
        @create="handleCreate"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  CHECKPOINT_TYPE,
  CHECKPOINT_STATUS,
  fetchCheckpointsForDay,
  createCheckpoint,
  summarizeCheckpoint
} from '@/composables/useCheckpointsMock'
import CheckpointTypeBadge from '@/components/checkpoints-prototype/CheckpointTypeBadge.vue'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointCreateModal from '@/components/checkpoints-prototype/CheckpointCreateModal.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const router = useRouter()

const FINISHED = CHECKPOINT_STATUS.FINISHED

// Synthetische Gesamtzahlen fuer die Kopfkachel - bewusst konstant, nicht
// aus dem echten useBusData/useConfigStore gelesen (siehe Plan, "Risiken").
const mockTotalKinder = 42
const mockTotalBetreuer = 8

const loading = ref(true)
const checkpoints = ref([])
const results = ref({})
const showCreateModal = ref(false)
const createError = ref(null)

const openTypes = computed(() =>
    checkpoints.value
        .filter(cp => cp.status === CHECKPOINT_STATUS.OPEN)
        .map(cp => cp.type)
)

const anomalousIds = computed(() => {
  const openCounts = {}
  checkpoints.value.forEach(cp => {
    if (cp.status === CHECKPOINT_STATUS.OPEN) {
      openCounts[cp.type] = (openCounts[cp.type] || 0) + 1
    }
  })
  const result = new Set()
  checkpoints.value.forEach(cp => {
    if (cp.status === CHECKPOINT_STATUS.OPEN && openCounts[cp.type] > 1) {
      result.add(cp.id)
    }
  })
  return result
})

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  checkpoints.value = await fetchCheckpointsForDay(today())
  const entries = await Promise.all(
      checkpoints.value.map(async cp => [cp.id, await summarizeCheckpoint(cp)])
  )
  results.value = Object.fromEntries(entries)
  loading.value = false
}

async function handleCreate(type) {
  const result = await createCheckpoint(type)
  if (result?.error) {
    createError.value = result
    showCreateModal.value = false
    return
  }
  showCreateModal.value = false
  createError.value = null
  await load()
}

function routeForType(type) {
  switch (type) {
    case CHECKPOINT_TYPE.BUS: return 'bus'
    case CHECKPOINT_TYPE.GROUP: return 'group'
    case CHECKPOINT_TYPE.LAZY: return 'lazy'
    default: return 'bus'
  }
}

function openDetail(cp) {
  router.push(`/admin/checkpoints-prototype/${routeForType(cp.type)}/${cp.id}`)
}

function goBack() {
  router.push('/main')
}

onMounted(load)
</script>

<style scoped>
.cp-list-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
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

.cp-big-number {
  font-size: 2.8rem;
  font-weight: 800;
  line-height: 1.1;
}

.cp-btn-create {
  min-height: 52px;
  font-size: 1.15rem;
  font-weight: 700;
}

.cp-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cp-item-card {
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  border-left: 6px solid transparent;
  background-color: #fff;
  transition: box-shadow 0.15s ease;
}

.cp-item-card-open {
  border-left-color: #198754;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.cp-item-card-closed {
  background-color: #f1f3f5;
  color: #868e96;
}

.cp-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cp-item-seq {
  font-size: 1.3rem;
  font-weight: 800;
}

.cp-item-card-closed .cp-item-seq {
  color: #868e96;
}

.cp-item-body {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
  margin-top: 4px;
}

.cp-item-card-closed .cp-item-body {
  color: #868e96;
}

.cp-item-result {
  display: flex;
  gap: 14px;
  margin-top: 4px;
}

.cp-item-stat-kinder {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0d6efd;
}

.cp-item-card-closed .cp-item-stat-kinder {
  color: #6c8fb5;
}

.cp-item-stat-betreuer {
  font-size: 1.25rem;
  font-weight: 800;
  color: #dc3545;
}

.cp-item-card-closed .cp-item-stat-betreuer {
  color: #b58a8e;
}

.cp-item-stat-present {
  font-size: 1.25rem;
  font-weight: 800;
}

.cp-item-delta {
  font-size: 0.85rem;
  font-weight: 700;
  color: #b02a37;
}

.cp-item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.cp-item-anomaly {
  font-size: 0.85rem;
  font-weight: 700;
  color: #b02a37;
}
</style>
