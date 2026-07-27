<!-- src/views/CheckpointLazyPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Lazy-Checkpoint,
     ausschliesslich Mock-Daten (useLazyCheckpointProgressMock.js). Neuer
     Bildschirmtyp ohne bestehendes Vorbild in AdminBusView/ChildrenView -
     drei Listen: gemeldet/noch nicht gemeldet/letzte Meldung. Finish ist
     die einzige Art, eine Lazy-Checkpoint zu schliessen - kein Auto-Finish
     (decision.md, Punkt 2, gilt explizit auch fuer Lazy). -->
<template>
  <div class="cp-detail-view">
    <div class="d-flex align-items-center mb-3">
      <button class="btn btn-sm btn-outline-secondary me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <h4 class="mb-0 me-2">Lazy Checkpoint #{{ checkpoint?.seq }}</h4>
      <template v-if="checkpoint">
        <CheckpointTypeBadge :type="checkpoint.type" class="me-1" />
        <CheckpointStatusBadge :status="checkpoint.status" :day="checkpoint.day" class="me-1" />
        <CheckpointOriginBadge :created-by="checkpoint.created_by" />
      </template>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="checkpoint">
      <div class="d-flex gap-2 mb-3">
        <button
            class="btn btn-success"
            :disabled="checkpoint.status !== OPEN"
            @click="onFinish"
        >
          <font-awesome-icon :icon="['fas', 'check-circle']" class="me-2" />
          Finish
        </button>
        <button
            class="btn btn-outline-danger"
            :disabled="checkpoint.status !== OPEN"
            @click="onCancel"
        >
          <font-awesome-icon :icon="['fas', 'times']" class="me-2" />
          Cancel
        </button>
      </div>

      <div class="card mb-3">
        <div class="card-body text-center">
          <div class="text-muted">Letzte Meldung</div>
          <div class="fs-5 fw-bold">{{ progress?.lastScanAt ? formatTime(progress.lastScanAt) : '—' }}</div>
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <div class="card h-100">
            <div class="card-body">
              <h5 class="card-title">
                <font-awesome-icon :icon="['fas', 'check-circle']" class="me-2 text-success" />
                Gemeldet ({{ progress?.checkedIn.length || 0 }})
              </h5>
              <div class="list-group">
                <div v-for="child in progress?.checkedIn" :key="child.id" class="list-group-item d-flex justify-content-between">
                  <span>{{ child.name }}</span>
                  <span class="text-muted">{{ formatTime(child.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-6 mb-3">
          <div class="card h-100">
            <div class="card-body">
              <h5 class="card-title">
                <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2 text-warning" />
                Noch nicht gemeldet ({{ progress?.notYet.length || 0 }})
              </h5>
              <div v-if="!progress?.notYet.length" class="text-muted">Alle haben sich gemeldet.</div>
              <div v-else class="list-group">
                <div v-for="child in progress.notYet" :key="child.id" class="list-group-item">
                  {{ child.name }}
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CHECKPOINT_STATUS,
  fetchCheckpointDetail,
  finishCheckpoint,
  cancelCheckpoint
} from '@/composables/useCheckpointsMock'
import { fetchLazyCheckpointProgress } from '@/composables/useLazyCheckpointProgressMock'
import CheckpointTypeBadge from '@/components/checkpoints-prototype/CheckpointTypeBadge.vue'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const progress = ref(null)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  const id = Number(route.params.id)
  checkpoint.value = await fetchCheckpointDetail(id)
  if (checkpoint.value) {
    progress.value = await fetchLazyCheckpointProgress(id)
  }
  loading.value = false
}

async function onFinish() {
  await finishCheckpoint(checkpoint.value.id)
  await load()
}

async function onCancel() {
  await cancelCheckpoint(checkpoint.value.id)
  await load()
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
}
</style>
