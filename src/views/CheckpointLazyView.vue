<!-- src/views/CheckpointLazyView.vue -->
<!-- Ticket 135 - reales Pendant zu CheckpointLazyPrototypeView.vue: einziger
     Bildschirmtyp ohne bestehendes Vorbild (kein AdminBusView/ChildrenView-
     Aequivalent). Fortschritt kommt aus useLazyCheckpointProgress.js
     (Ticket 133): "gemeldet" = Kinder mit einem Scan ueber ein scan_packets
     dieser Checkpoint, "noch nicht" = voller Roster minus dieser Menge,
     "letzte Meldung" = MAX(scan_packets.received_at). Kein Auto-Finish
     (tickets/130/decision.md, Punkt 2/6) - Finish ist die einzige Art zu
     schliessen, mit Warnung bei notYet.length > 0 (135.txt, "Kriterium fuer
     Finish - entschieden, keine offene Frage"). -->
<template>
  <div class="cp-detail-view">
    <div class="cp-header">
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">Lazy Checkpoint #{{ checkpoint?.seq }}</span>
        <button v-if="checkpoint" class="cp-remove-btn" title="Entfernen" @click="onRemove">
          <font-awesome-icon :icon="['fas', 'trash-alt']" />
        </button>
      </div>

      <template v-if="checkpoint">
        <div class="cp-header-line">
          <CheckpointOriginBadge :created-by="checkpoint.created_by" />
        </div>

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
          <button
              v-if="checkpoint.status === FINISHED && resultSummary && !resultSummary.hasBaseline"
              class="btn btn-outline-primary cp-toggle-btn"
              @click="onSetBaseline"
          >
            Als Tagesreferenz festhalten
          </button>
        </div>

        <div v-if="actionError" class="alert alert-danger py-2">
          <template v-if="actionError.error === 'ALREADY_OPEN'">
            Es ist bereits ein anderer Lazy-Checkpoint offen (#{{ actionError.existingId }}). Zuerst diesen schließen.
          </template>
          <template v-else-if="actionError.error === 'BASELINE_ALREADY_SET'">
            Die Tagesreferenz wurde bereits von einem anderen Checkpoint festgelegt.
          </template>
        </div>

        <div v-if="resultSummary" class="cp-result-row cp-result-row-final">
          <CountLink :count="`${resultSummary.present} / ${resultSummary.total}`" :icon="['fas', 'child']" variant="default" @click="openList({ filter: 'checkedIn' })" />
          <template v-if="!resultSummary.isBaselineCheckpoint && (resultSummary.missing > 0 || resultSummary.extra > 0)">
            <CountLink v-if="resultSummary.missing > 0" :count="resultSummary.missing" label="fehlen" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ filter: 'notYet' })" />
            <CountLink v-if="resultSummary.extra > 0" :count="resultSummary.extra" label="mehr" :icon="['fas', 'exclamation-triangle']" variant="warning" />
          </template>
        </div>
      </template>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="checkpoint">
      <div class="card mb-3">
        <div class="card-body text-center">
          <div class="text-muted">Letzte Meldung</div>
          <div class="cp-last-scan">{{ progress?.lastScanAt ? formatTime(progress.lastScanAt) : '—' }}</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <CountLink
              :count="progress?.checkedIn.length || 0"
              label="Gemeldet"
              :icon="['fas', 'check-circle']"
              variant="kinder"
              @click="openList({ filter: 'checkedIn' })"
          />
          <div class="cp-scroll-list-lg mt-2">
            <div v-for="(child, idx) in progress?.checkedIn" :key="child.id" class="cp-child-row">
              <span class="cp-child-name">{{ idx + 1 }}. <ChildLink :child="child" /></span>
              <span class="cp-child-meta">{{ formatTime(child.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="resultSummary?.hasBaseline" class="card">
        <div class="card-body">
          <CountLink
              :count="progress?.notYet.length || 0"
              label="Noch nicht gemeldet"
              :icon="['fas', 'exclamation-triangle']"
              variant="warning"
              @click="openList({ filter: 'notYet' })"
          />
          <div v-if="!progress?.notYet.length" class="text-muted mt-2">Alle haben sich gemeldet.</div>
          <div v-else class="cp-scroll-list-lg mt-2">
            <div v-for="group in notYetByGroup" :key="group.groupId" class="mb-2">
              <div class="cp-group-heading">Gruppe {{ group.groupId }}</div>
              <div v-for="child in group.children" :key="child.id" class="cp-child-row">
                <ChildLink :child="child" />
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import {
  CHECKPOINT_STATUS,
  fetchCheckpointDetail,
  finishCheckpoint,
  setCheckpointBaseline,
  reopenCheckpoint,
  removeCheckpoint,
  summarizeCheckpoint,
  checkpointHasOpenIssues
} from '@/composables/useCheckpoints'
import { fetchLazyCheckpointProgress } from '@/composables/useLazyCheckpointProgress'
import CheckpointStatusBadge from '@/components/checkpoints/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints/CheckpointOriginBadge.vue'
import CountLink from '@/components/checkpoints/CountLink.vue'
import ChildLink from '@/components/checkpoints/ChildLink.vue'

const OPEN = CHECKPOINT_STATUS.OPEN
const FINISHED = CHECKPOINT_STATUS.FINISHED

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const progress = ref(null)
const resultSummary = ref(null)
const actionError = ref(null)

let realtimeChannel = null
let reloadDebounceTimer = null
let hasLoadedOnce = false

const notYetByGroup = computed(() => {
  const byGroup = new Map()
  for (const child of progress.value?.notYet || []) {
    if (!byGroup.has(child.groupId)) {
      byGroup.set(child.groupId, [])
    }
    byGroup.get(child.groupId).push(child)
  }
  return Array.from(byGroup.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([groupId, children]) => ({ groupId, children }))
})

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function openList({ filter }) {
  router.push({
    path: '/admin/checkpoints/list',
    query: {
      kind: 'child',
      scope: 'lazy',
      filter,
      checkpointId: String(checkpoint.value.id)
    }
  })
}

async function load() {
  if (!hasLoadedOnce) loading.value = true
  try {
    const id = Number(route.params.id)
    checkpoint.value = await fetchCheckpointDetail(id)
    if (checkpoint.value) {
      progress.value = await fetchLazyCheckpointProgress(id)
      resultSummary.value = await summarizeCheckpoint(checkpoint.value)
    }
    hasLoadedOnce = true
  } finally {
    loading.value = false
  }
}

function debouncedReload() {
  if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer)
  reloadDebounceTimer = setTimeout(load, 400)
}

async function onFinish() {
  actionError.value = null
  let setBaseline = true
  if (resultSummary.value && !resultSummary.value.hasBaseline) {
    setBaseline = confirm('Soll die aktuelle Liste der anwesenden Kinder als Tagesreferenz festgehalten werden?')
  }
  const issues = await checkpointHasOpenIssues(checkpoint.value)
  if (issues.hasIssues && !confirm(`${issues.message} Trotzdem schließen?`)) {
    return
  }
  await finishCheckpoint(checkpoint.value.id, setBaseline)
  await load()
}

async function onSetBaseline() {
  actionError.value = null
  const result = await setCheckpointBaseline(checkpoint.value.id)
  if (result?.error) {
    actionError.value = result
    return
  }
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
      .channel(`checkpoint-lazy-${id}-changes`)
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

.cp-result-row-final {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 2px solid #dee2e6;
}

.cp-result-row-final :deep(.cp-count-link-number) {
  font-size: 1.9rem;
}

.cp-result-row-final :deep(.cp-count-link-label) {
  font-size: 1.05rem;
}

.cp-last-scan {
  font-size: 2rem;
  font-weight: 800;
}

.cp-scroll-list-lg {
  max-height: 320px;
  overflow-y: auto;
}

.cp-child-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 4px;
  border-bottom: 1px solid #eee;
  font-size: 1.05rem;
}

.cp-child-name {
  font-weight: 600;
}

.cp-child-meta {
  color: #6c757d;
  font-size: 0.95rem;
  white-space: nowrap;
}

.cp-group-heading {
  font-weight: 800;
  font-size: 1.1rem;
  margin-top: 8px;
  padding: 4px;
  background-color: #f1f3f5;
  border-radius: 6px;
}
</style>
