<!-- src/views/CheckpointGroupPrototypeView.vue -->
<!-- Ticket 130_2 - Detail-/Monitoring-Bildschirm fuer eine Group-Checkpoint,
     ausschliesslich Mock-Daten. Raster orientiert sich visuell an
     ChildrenView.vue/GroupDetailModal.vue (nicht wiederverwendet als Code).

     UX-Feedback Runde 1:
     - EL1: Kopfzeile war einzeilig und lief aus dem Bildschirm - jetzt
       mehrzeilig (Titel/Status/Erstellt von je eigene Zeile).
     - EL2: "Cancel" durch getrennte Aktionen ersetzt - Schliessen/Oeffnen
       (reopenCheckpoint, Gegenteil von Finish) und Entfernen
       (removeCheckpoint, mit Bestaetigung, verschwindet aus der Liste statt
       mit verwirrendem Status weiterzulaufen).
     - EL3: Tabelle durch Kartenraster ersetzt (eine Karte pro Gruppe, Farbe
       zeigt Status, kein separater Status-Punkt mehr noetig); zeigt jetzt
       auch den Fall "mehr Kinder als am Morgen" (Kind kam spaeter dazu).
     - EL4: Detailpanel fuer fehlende Kinder einer angeklickten Gruppe. -->
<template>
  <div class="cp-detail-view">
    <DebugTag variant="page" label="Page 3" />

    <div class="cp-header">
      <DebugTag label="el1" />
      <div class="cp-header-top">
        <button class="btn btn-sm btn-outline-secondary me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">Group Checkpoint #{{ checkpoint?.seq }}</span>
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
          Es ist bereits ein anderer Group-Checkpoint offen (#{{ actionError.existingId }}). Zuerst diesen schließen.
        </template>
      </div>

      <div class="card">
        <div class="card-body">
          <DebugTag label="el3" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
            Gruppen
          </h5>

          <div class="cp-group-grid">
            <div
                v-for="group in checkpoint.groups"
                :key="group.groupId"
                class="cp-group-card"
                :class="groupCardClass(group)"
                role="button"
                @click="toggleExpand(group)"
            >
              <div class="cp-group-num">{{ group.groupId }}</div>
              <div class="cp-group-count">{{ groupCountText(group) }}</div>
              <div class="cp-group-status-text">{{ groupStatusText(group) }}</div>
            </div>
          </div>

          <div v-if="expandedGroup" class="cp-expand-panel">
            <DebugTag label="el4" />
            <div class="fw-bold mb-2">Gruppe {{ expandedGroup.groupId }}</div>
            <div v-if="expandedGroup.missingChildren.length">
              Fehlende Kinder: {{ expandedGroup.missingChildren.map(c => c.name).join(', ') }}
            </div>
            <div v-else class="text-muted">Keine fehlenden Kinder.</div>
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
  reopenCheckpoint,
  removeCheckpoint
} from '@/composables/useCheckpointsMock'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const expandedGroupId = ref(null)
const actionError = ref(null)

const expandedGroup = ref(null)

function groupCardClass(group) {
  if (!group.hasData) return 'cp-group-card-none'
  if (group.current === group.morning) return 'cp-group-card-ok'
  if (group.current < group.morning) return 'cp-group-card-missing'
  return 'cp-group-card-extra'
}

function groupCountText(group) {
  if (!group.hasData) return '—'
  return `${group.morning} → ${group.current}`
}

function groupStatusText(group) {
  if (!group.hasData) return 'Keine Daten'
  if (group.current === group.morning) return 'OK'
  if (group.current < group.morning) return `Fehlen: ${group.morning - group.current}`
  return `+${group.current - group.morning} mehr`
}

function toggleExpand(group) {
  if (expandedGroupId.value === group.groupId) {
    expandedGroupId.value = null
    expandedGroup.value = null
  } else {
    expandedGroupId.value = group.groupId
    expandedGroup.value = group
  }
}

async function load() {
  loading.value = true
  checkpoint.value = await fetchCheckpointDetail(Number(route.params.id))
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

.cp-group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
  margin-top: 8px;
}

.cp-group-card {
  border-radius: 12px;
  padding: 14px 8px;
  text-align: center;
  cursor: pointer;
  border: 2px solid transparent;
}

.cp-group-num {
  font-size: 1.6rem;
  font-weight: 800;
}

.cp-group-count {
  font-size: 1.3rem;
  font-weight: 700;
  margin-top: 4px;
}

.cp-group-status-text {
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 4px;
}

.cp-group-card-ok {
  background-color: #d1e7dd;
  color: #0f5132;
}

.cp-group-card-missing {
  background-color: #f8d7da;
  color: #842029;
}

.cp-group-card-extra {
  background-color: #cff4fc;
  color: #055160;
}

.cp-group-card-none {
  background-color: #e9ecef;
  color: #495057;
}

.cp-expand-panel {
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  background-color: #fff3cd;
  font-size: 1.05rem;
}
</style>
