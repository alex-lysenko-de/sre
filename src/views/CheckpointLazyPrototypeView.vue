<!-- src/views/CheckpointLazyPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Lazy-Checkpoint,
     ausschliesslich Mock-Daten (useLazyCheckpointProgressMock.js). Neuer
     Bildschirmtyp ohne bestehendes Vorbild in AdminBusView/ChildrenView -
     drei Listen: gemeldet/noch nicht gemeldet/letzte Meldung. Finish ist
     die einzige Art, eine Lazy-Checkpoint zu schliessen - kein Auto-Finish
     (decision.md, Punkt 2, gilt explizit auch fuer Lazy).

     UX-Feedback Runde 1:
     - EL1: mehrzeilige Kopfzeile statt einzeiliger Ueberschrift.
     - EL2: "Cancel" ersetzt durch Schliessen/Oeffnen/Entfernen.
     - EL4 (Gemeldet): bei ~150 Kindern ist eine einfache Liste ohne
       Struktur nicht mehr lesbar - jede Zeile zeigt jetzt laufende Nummer,
       Gruppe und Uhrzeit kompakt untereinander statt nur den Namen.
     - EL5 (Noch nicht gemeldet): nach Gruppe gruppiert statt einer langen
       Gesamtliste, damit man gezielt eine Gruppe durchsuchen kann. -->
<template>
  <div class="cp-detail-view">
    <DebugTag variant="page" label="Page 4" />

    <div class="cp-header">
      <DebugTag label="el1" />
      <div class="cp-header-top">
        <button class="btn btn-sm btn-outline-secondary me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">Lazy Checkpoint #{{ checkpoint?.seq }}</span>
      </div>
      <template v-if="checkpoint">
        <div class="cp-header-line">
          <CheckpointStatusBadge :status="checkpoint.status" :day="checkpoint.day" />
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
      <div class="cp-actions">
        <DebugTag label="el2" />

        <button
            v-if="checkpoint.status === OPEN"
            class="btn btn-success cp-action-btn"
            @click="onFinish"
        >
          <font-awesome-icon :icon="['fas', 'check-circle']" class="me-2" />
          Schließen
        </button>
        <button
            v-else
            class="btn btn-primary cp-action-btn"
            @click="onReopen"
        >
          <font-awesome-icon :icon="['fas', 'redo']" class="me-2" />
          Öffnen
        </button>

        <button class="btn btn-outline-danger cp-action-btn" @click="onRemove">
          <font-awesome-icon :icon="['fas', 'trash-alt']" class="me-2" />
          Entfernen
        </button>
      </div>

      <div v-if="actionError" class="alert alert-danger">
        <template v-if="actionError.error === 'ALREADY_OPEN'">
          Es ist bereits ein anderer Lazy-Checkpoint offen (#{{ actionError.existingId }}). Zuerst diesen schließen.
        </template>
      </div>

      <div class="card mb-3">
        <div class="card-body text-center">
          <DebugTag label="el3" />
          <div class="text-muted">Letzte Meldung</div>
          <div class="cp-last-scan">{{ progress?.lastScanAt ? formatTime(progress.lastScanAt) : '—' }}</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <DebugTag label="el4" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'check-circle']" class="me-2 text-success" />
            Gemeldet ({{ progress?.checkedIn.length || 0 }})
          </h5>
          <div class="cp-scroll-list-lg">
            <div v-for="(child, idx) in progress?.checkedIn" :key="child.id" class="cp-child-row">
              <span class="cp-child-name">{{ idx + 1 }}. {{ child.name }}</span>
              <span class="cp-child-meta">Gruppe {{ child.groupId }} · {{ formatTime(child.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <DebugTag label="el5" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2 text-warning" />
            Noch nicht gemeldet ({{ progress?.notYet.length || 0 }})
          </h5>
          <div v-if="!progress?.notYet.length" class="text-muted">Alle haben sich gemeldet.</div>
          <div v-else class="cp-scroll-list-lg">
            <div v-for="group in notYetByGroup" :key="group.groupId" class="mb-2">
              <div class="cp-group-heading">Gruppe {{ group.groupId }}</div>
              <div v-for="child in group.children" :key="child.id" class="cp-child-row">
                <span class="cp-child-name">{{ child.name }}</span>
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
  removeCheckpoint
} from '@/composables/useCheckpointsMock'
import { fetchLazyCheckpointProgress } from '@/composables/useLazyCheckpointProgressMock'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const progress = ref(null)
const actionError = ref(null)

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
}

.cp-header-line {
  margin-bottom: 6px;
}

.cp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 16px 0;
}

.cp-action-btn {
  min-height: 56px;
  font-size: 1.1rem;
  font-weight: 700;
  padding: 12px 20px;
  flex: 1 1 auto;
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
