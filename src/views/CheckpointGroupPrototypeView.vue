<!-- src/views/CheckpointGroupPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Group-Checkpoint,
     ausschliesslich Mock-Daten. Raster orientiert sich visuell an
     ChildrenView.vue/GroupDetailModal.vue (nicht wiederverwendet als Code).
     Neu gegenueber dem Vorbild: Einklappen "sauberer" Gruppen (130_2.txt,
     "различные состояния интерфейса"). -->
<template>
  <div class="cp-detail-view">
    <DebugTag variant="page" label="Page 3" />

    <div class="d-flex align-items-center mb-3">
      <DebugTag label="el1" />
      <button class="btn btn-sm btn-outline-secondary me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <h4 class="mb-0 me-2">Group Checkpoint #{{ checkpoint?.seq }}</h4>
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
      <div class="d-flex align-items-center gap-2 mb-3">
        <DebugTag label="el2" />
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
          <DebugTag label="el3" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
            Gruppen
          </h5>

          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <thead>
              <tr>
                <th>Status</th>
                <th>Gruppe</th>
                <th>Morgen</th>
                <th>Aktuell</th>
                <th>Betreuer</th>
                <th>Differenz</th>
              </tr>
              </thead>
              <tbody>
              <template v-for="group in problematicGroups" :key="group.groupId">
                <tr role="button" @click="toggleExpand(group)">
                  <td><span class="status-dot" :class="statusClass(group)"></span></td>
                  <td>Gruppe {{ group.groupId }}</td>
                  <td>{{ group.hasData ? group.morning : '-' }}</td>
                  <td>{{ group.hasData ? group.current : '-' }}</td>
                  <td>
                    <span v-if="group.betreuer.length">{{ group.betreuer.join(', ') }}</span>
                    <span v-else class="text-muted">
                      {{ group.hasData ? '—' : 'Keine Kinder erfasst' }}
                    </span>
                  </td>
                  <td v-html="formatDifference(group)"></td>
                </tr>
                <tr v-if="expandedGroupId === group.groupId && group.missingChildren.length">
                  <td colspan="6">
                    <div class="alert alert-warning mb-0">
                      Fehlende Kinder: {{ group.missingChildren.map(c => c.name).join(', ') }}
                    </div>
                  </td>
                </tr>
              </template>
              </tbody>
            </table>
          </div>

          <DebugTag label="el4" />
          <button v-if="cleanGroups.length" class="btn btn-sm btn-outline-secondary mt-2" @click="showClean = !showClean">
            {{ showClean ? 'Saubere Gruppen ausblenden' : `${cleanGroups.length} saubere Gruppe(n) anzeigen` }}
          </button>

          <div v-if="showClean" class="table-responsive mt-2">
            <table class="table table-sm align-middle">
              <tbody>
              <tr v-for="group in cleanGroups" :key="group.groupId">
                <td><span class="status-dot bg-success"></span></td>
                <td>Gruppe {{ group.groupId }}</td>
                <td>{{ group.morning }}</td>
                <td>{{ group.current }}</td>
                <td>{{ group.betreuer.join(', ') }}</td>
                <td><span class="text-success fw-bold">Komplett</span></td>
              </tr>
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
import { ref, computed, onMounted } from 'vue'
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
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const expandedGroupId = ref(null)
const showClean = ref(false)

const isCleanGroup = (group) => group.hasData && group.current === group.morning

const cleanGroups = computed(() => (checkpoint.value?.groups || []).filter(isCleanGroup))
const problematicGroups = computed(() => (checkpoint.value?.groups || []).filter(g => !isCleanGroup(g)))

function statusClass(group) {
  if (!group.hasData) return 'bg-secondary'
  if (group.current === group.morning) return 'bg-success'
  if (group.current < group.morning) return 'bg-danger'
  return 'bg-info'
}

function formatDifference(group) {
  if (!group.hasData) return '<span class="text-muted">—</span>'
  const diff = group.morning - group.current
  if (diff === 0) return '<span class="text-success fw-bold">Komplett</span>'
  if (diff > 0) return `<span class="text-danger fw-bold">-${diff}</span>`
  return `<span class="text-info fw-bold">+${Math.abs(diff)}</span>`
}

function toggleExpand(group) {
  if (!group.missingChildren.length) return
  expandedGroupId.value = expandedGroupId.value === group.groupId ? null : group.groupId
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

.status-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
</style>
