<!-- src/views/CheckpointBusPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Bus-Checkpoint,
     ausschliesslich Mock-Daten. Raster orientiert sich visuell an
     AdminBusView.vue/BusDetailModal.vue (nicht wiederverwendet als Code,
     siehe tickets/130_2/IMPLEMENTATION_PLAN.md, "Anализ"). -->
<template>
  <div class="cp-detail-view">
    <div class="d-flex align-items-center mb-3">
      <button class="btn btn-sm btn-outline-secondary me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <h4 class="mb-0 me-2">Bus Checkpoint #{{ checkpoint?.seq }}</h4>
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

      <div class="card">
        <div class="card-body">
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'bus']" class="me-2" />
            Busse
          </h5>

          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <thead>
              <tr>
                <th>Bus</th>
                <th>Kinder</th>
                <th>Betreuer</th>
                <th>Verantwortliche</th>
                <th></th>
              </tr>
              </thead>
              <tbody>
              <template v-for="bus in checkpoint.buses" :key="bus.busNumber">
                <tr :class="{ 'table-secondary': !bus.hasData }">
                  <td class="fw-bold">
                    <span class="status-indicator me-2" :class="bus.hasData ? 'bg-success' : 'bg-secondary'"></span>
                    {{ bus.busNumber }}
                  </td>
                  <td>
                    <span v-if="bus.hasData" class="badge bg-primary">{{ bus.kinderCount }}</span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span v-if="bus.hasData" class="badge bg-success">{{ bus.betreuerCount }}</span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span v-if="bus.betreuerNames.length">{{ bus.betreuerNames.join(', ') }}</span>
                    <span v-else class="text-muted">
                      {{ bus.hasData ? '—' : 'Keine Kinder zugeordnet' }}
                    </span>
                  </td>
                  <td>
                    <button
                        v-if="bus.packets.length"
                        class="btn btn-sm btn-link"
                        @click="toggleExpand(bus.busNumber)"
                    >
                      <font-awesome-icon :icon="['fas', 'inbox']" />
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedBus === bus.busNumber">
                  <td colspan="5">
                    <div class="list-group">
                      <div v-for="packet in bus.packets" :key="packet.id" class="list-group-item d-flex justify-content-between">
                        <div>
                          <strong>{{ packet.authorName }}</strong>
                          <span class="text-muted ms-2">{{ formatTime(packet.receivedAt) }}</span>
                        </div>
                        <span class="badge bg-primary">{{ packet.childrenCount }} Kinder</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              </tbody>
            </table>
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
import CheckpointTypeBadge from '@/components/checkpoints-prototype/CheckpointTypeBadge.vue'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const expandedBus = ref(null)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toggleExpand(busNumber) {
  expandedBus.value = expandedBus.value === busNumber ? null : busNumber
}

async function load() {
  loading.value = true
  checkpoint.value = await fetchCheckpointDetail(Number(route.params.id))
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

.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
