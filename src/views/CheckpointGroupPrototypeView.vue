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
     - EL4: Detailpanel fuer fehlende Kinder einer angeklickten Gruppe.

     UX-Feedback Runde 2:
     - EL1/EL2: Status und Schliessen/Oeffnen stehen jetzt nebeneinander in
       einer Zeile; Entfernen ist ein kleiner Icon-Button neben dem Titel
       (seltene, gefaehrliche Aktion - soll nicht dominieren).
     - EL3/EL4: Kartenraster durch eine Akkordeon-Liste ersetzt - Gruppen
       ohne Probleme bleiben einzeilig kompakt, Gruppen mit fehlenden/
       zusaetzlichen Kindern nehmen die volle Breite ein und klappen beim
       Anklicken direkt an Ort und Stelle auf (kein Panel mehr unterhalb des
       gesamten Rasters). -->
<template>
  <div class="cp-detail-view">
    <DebugTag variant="page" label="Page 3" />

    <div class="cp-header">
      <DebugTag label="el1" />
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">Group Checkpoint #{{ checkpoint?.seq }}</span>
        <button v-if="checkpoint" class="cp-remove-btn" title="Entfernen" @click="onRemove">
          <font-awesome-icon :icon="['fas', 'trash-alt']" />
        </button>
      </div>

      <template v-if="checkpoint">
        <div class="cp-status-row">
          <DebugTag label="el2" />
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

        <div v-if="actionError" class="alert alert-danger py-2">
          <template v-if="actionError.error === 'ALREADY_OPEN'">
            Es ist bereits ein anderer Group-Checkpoint offen (#{{ actionError.existingId }}). Zuerst diesen schließen.
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
      <div class="card">
        <div class="card-body">
          <DebugTag label="el3" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
            Gruppen
          </h5>

          <div class="cp-group-accordion">
            <div
                v-for="group in checkpoint.groups"
                :key="group.groupId"
                class="cp-group-row"
                :class="[groupCardClass(group), expandedGroupId === group.groupId ? 'cp-group-row-expanded' : '', group.missingChildren.length ? 'cp-group-row-full' : '']"
                role="button"
                @click="toggleExpand(group)"
            >
              <div class="cp-group-row-main">
                <span class="cp-group-row-num">{{ group.groupId }}</span>
                <span class="cp-group-row-count">{{ groupCountText(group) }}</span>
                <span class="cp-group-row-status">
                  <font-awesome-icon :icon="groupStatusIcon(group)" class="me-1" />
                  {{ groupStatusText(group) }}
                </span>
              </div>

              <div v-if="expandedGroupId === group.groupId && group.missingChildren.length" class="cp-group-row-detail" @click.stop>
                <DebugTag label="el4" />
                <div class="fw-bold mb-1">Fehlende Kinder:</div>
                <div>{{ group.missingChildren.map(c => c.name).join(', ') }}</div>
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

function groupStatusIcon(group) {
  if (!group.hasData) return ['fas', 'info-circle']
  if (group.current === group.morning) return ['fas', 'check-circle']
  return ['fas', 'exclamation-triangle']
}

function toggleExpand(group) {
  expandedGroupId.value = expandedGroupId.value === group.groupId ? null : group.groupId
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

.cp-group-accordion {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.cp-group-row {
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  border: 2px solid transparent;
  flex: 1 1 130px;
}

.cp-group-row-full {
  flex: 1 1 100%;
}

.cp-group-row-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-group-row-num {
  font-size: 1.4rem;
  font-weight: 800;
}

.cp-group-row-count {
  font-size: 1.2rem;
  font-weight: 700;
  flex: 1;
}

.cp-group-row-status {
  font-size: 1rem;
  font-weight: 700;
  white-space: nowrap;
}

.cp-group-row-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.15);
  font-size: 1.05rem;
  cursor: default;
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
</style>
