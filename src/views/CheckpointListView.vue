<!-- src/views/CheckpointListView.vue -->
<!-- Ticket 131 - reale Haupt-/Listenansicht der "Checkpoint"-Funktion.
     Ported from the 130_2 prototype (CheckpointListPrototypeView.vue) - alle
     4 UX-Feedback-Runden bleiben erhalten, Datenquelle wechselt auf
     useCheckpoints.js (echte Supabase-Abfragen statt In-Memory-Mock).
     DebugTag entfernt.

     Anpassung fuer echte Daten: die "Gesamt"-Kachel war im Mock bewusst
     synthetisch (hardcoded); hier real aus fetchAllChildren()/
     user_group_day berechnet. -->
<template>
  <div class="cp-list-view">
    <div class="d-flex align-items-center mb-3">
      <button class="cp-back-btn me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <h4 class="mb-0">Checkpoints</h4>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h5 class="mb-3 text-center">Gesamt</h5>
        <div class="row text-center">
          <div class="col-6">
            <div class="cp-big-number text-primary">{{ totalKinder }}</div>
            <div class="text-muted">Kinder</div>
          </div>
          <div class="col-6">
            <div class="cp-big-number text-success">{{ totalBetreuer }}</div>
            <div class="text-muted">Betreuer</div>
          </div>
        </div>
      </div>
    </div>

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
import { supabase } from '@/supabase'
import { useChildren } from '@/composables/useChildren'
import {
  CHECKPOINT_TYPE,
  CHECKPOINT_STATUS,
  todayString,
  fetchCheckpointsForDay,
  createCheckpoint,
  summarizeCheckpoint
} from '@/composables/useCheckpoints'
import CheckpointTypeBadge from '@/components/checkpoints/CheckpointTypeBadge.vue'
import CheckpointStatusBadge from '@/components/checkpoints/CheckpointStatusBadge.vue'
import CheckpointCreateModal from '@/components/checkpoints/CheckpointCreateModal.vue'

const router = useRouter()

const FINISHED = CHECKPOINT_STATUS.FINISHED

const loading = ref(true)
const checkpoints = ref([])
const results = ref({})
const showCreateModal = ref(false)
const createError = ref(null)
const totalKinder = ref(0)
const totalBetreuer = ref(0)

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

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

async function loadTotals() {
  const { fetchAllChildren } = useChildren()
  const [children, { data: betreuerRows, error }] = await Promise.all([
    fetchAllChildren(),
    supabase.from('user_group_day').select('user_id').eq('day', todayString()).eq('isPresentToday', 1)
  ])
  if (error) {
    console.error('Fehler beim Laden der Gesamt-Betreuerzahl:', error)
  }
  totalKinder.value = children.length
  totalBetreuer.value = new Set((betreuerRows || []).map(r => r.user_id)).size
}

async function load() {
  loading.value = true
  checkpoints.value = await fetchCheckpointsForDay(todayString())
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
  router.push(`/admin/checkpoints/${routeForType(cp.type)}/${cp.id}`)
}

function goBack() {
  router.push('/main')
}

onMounted(() => {
  load()
  loadTotals()
})
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
