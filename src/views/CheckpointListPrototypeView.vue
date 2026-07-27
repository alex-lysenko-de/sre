<!-- src/views/CheckpointListPrototypeView.vue -->
<!-- Ticket 130_2 - UI-Prototyp "Checkpoint"-Hauptbildschirm, ausschliesslich
     auf Mock-Daten (useCheckpointsMock.js). Kein Supabase-Aufruf, keine
     Realtime-Subscription - Liste/Detail teilen sich denselben
     reactive-Singleton, daher genuegt ein Neuladen nach jeder Aktion.
     Vorbild fuer die Raster ist tickets/130/IMPLEMENTATION_PLAN.md,
     "UI изменения" / "Главный экран". -->
<template>
  <div class="cp-list-view">
    <DebugTag variant="page" label="Page 1" />

    <div class="d-flex align-items-center mb-3">
      <DebugTag label="el1" />
      <button class="btn btn-sm btn-outline-secondary me-2" @click="goBack">
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
            <div class="display-5 fw-bold text-primary">{{ mockTotalKinder }}</div>
            <div class="text-muted">Kinder</div>
          </div>
          <div class="col-6">
            <div class="display-5 fw-bold text-success">{{ mockTotalBetreuer }}</div>
            <div class="text-muted">Betreuer</div>
          </div>
        </div>
      </div>
    </div>

    <DebugTag label="el3" />
    <button class="btn btn-success w-100 mb-3" @click="showCreateModal = true">
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

        <div v-else class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
            <tr>
              <th>#</th>
              <th>Typ</th>
              <th>Zeit</th>
              <th>Status</th>
              <th>Erstellt von</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="cp in checkpoints"
                :key="cp.id"
                role="button"
                @click="openDetail(cp)"
            >
              <td>#{{ cp.seq }}</td>
              <td><CheckpointTypeBadge :type="cp.type" /></td>
              <td>{{ formatTime(cp.created_at) }}</td>
              <td>
                <CheckpointStatusBadge
                    :status="cp.status"
                    :day="cp.day"
                    :anomaly="anomalousIds.has(cp.id)"
                />
              </td>
              <td><CheckpointOriginBadge :created-by="cp.created_by" /></td>
            </tr>
            </tbody>
          </table>
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
  createCheckpoint
} from '@/composables/useCheckpointsMock'
import CheckpointTypeBadge from '@/components/checkpoints-prototype/CheckpointTypeBadge.vue'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import CheckpointCreateModal from '@/components/checkpoints-prototype/CheckpointCreateModal.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const router = useRouter()

// Synthetische Gesamtzahlen fuer die Kopfkachel - bewusst konstant, nicht
// aus dem echten useBusData/useConfigStore gelesen (siehe Plan, "Risiken").
const mockTotalKinder = 42
const mockTotalBetreuer = 8

const loading = ref(true)
const checkpoints = ref([])
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
}

tbody tr {
  cursor: pointer;
}
</style>
