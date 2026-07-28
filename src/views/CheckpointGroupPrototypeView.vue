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
       gesamten Rasters).

     UX-Feedback Runde 3:
     - Bugfix EL3/EL4: das Detailpanel war nur fuer Gruppen mit
       missingChildren.length > 0 sichtbar - Klick auf eine OK- oder
       "mehr Kinder"-Gruppe klappte sichtbar nichts auf. Jetzt klappt jede
       Gruppe auf und zeigt je nach Zustand Fehlend-/OK-/Kein-Daten-Text.
     - EL2: zeigt jetzt zusaetzlich das Ergebnis (anwesend/gesamt) und die
       Abweichung zur Tagesbasis (summarizeCheckpoint()).
     - Schliessen warnt jetzt vorher bei fehlenden Kindern oder Gruppen ohne
       Daten (checkpointHasOpenIssues()).
     - Neuer Block "Kinder gesamt": anwesend/fehlend-Liste ueber alle
       Gruppen (getGroupChildrenBreakdown()), je mit Kopieren-Button. -->
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

        <div v-if="resultSummary" class="cp-result-row">
          <span class="cp-result-stat-present">
            <font-awesome-icon :icon="['fas', 'child']" /> {{ resultSummary.present }} / {{ resultSummary.total }}
          </span>
          <span
              v-if="!resultSummary.isBaselineCheckpoint && (resultSummary.missing > 0 || resultSummary.extra > 0)"
              class="cp-result-delta"
          >
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
            <template v-if="resultSummary.missing > 0">{{ resultSummary.missing }} fehlen</template>
            <template v-if="resultSummary.missing > 0 && resultSummary.extra > 0">, </template>
            <template v-if="resultSummary.extra > 0">{{ resultSummary.extra }} mehr</template>
          </span>
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
      <div class="card mb-3">
        <div class="card-body">
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'child']" class="me-2" />
            Kinder gesamt
          </h5>
          <div class="cp-breakdown-row">
            <div class="cp-breakdown-block cp-breakdown-absent">
              <div class="cp-breakdown-header">
                <span>Fehlend ({{ breakdown.absent.length }})</span>
                <button class="btn btn-sm cp-copy-btn" @click="copyChildList(breakdown.absent, 'absent')">
                  {{ copiedList === 'absent' ? 'Kopiert!' : 'Kopieren' }}
                </button>
              </div>
              <div class="cp-scroll-list">
                <div v-for="child in breakdown.absent" :key="child.name">
                  {{ child.name }} <span class="cp-child-group-tag">G-{{ child.groupId }}</span>
                </div>
                <div v-if="!breakdown.absent.length" class="text-muted">Keine.</div>
              </div>
            </div>
            <div class="cp-breakdown-block">
              <div class="cp-breakdown-header">
                <span>Anwesend ({{ breakdown.present.length }})</span>
                <button class="btn btn-sm cp-copy-btn" @click="copyChildList(breakdown.present, 'present')">
                  {{ copiedList === 'present' ? 'Kopiert!' : 'Kopieren' }}
                </button>
              </div>
              <div class="cp-scroll-list">
                <div v-for="child in breakdown.present" :key="child.name">
                  {{ child.name }} <span class="cp-child-group-tag">G-{{ child.groupId }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                :class="[
                    groupCardClass(group),
                    expandedGroupId === group.groupId ? 'cp-group-row-expanded' : '',
                    (group.missingChildren.length || expandedGroupId === group.groupId) ? 'cp-group-row-full' : ''
                ]"
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

              <div v-if="expandedGroupId === group.groupId" class="cp-group-row-detail" @click.stop>
                <DebugTag label="el4" />
                <template v-if="!group.hasData">
                  <div class="text-muted">Keine Daten für diese Gruppe.</div>
                </template>
                <template v-else-if="group.missingChildren.length">
                  <div class="fw-bold cp-detail-missing-label mb-1">Fehlende Kinder ({{ group.missingChildren.length }}):</div>
                  <div>{{ group.missingChildren.map(c => c.name).join(', ') }}</div>
                </template>
                <template v-else-if="group.current > group.morning">
                  <div class="cp-detail-extra">{{ group.current - group.morning }} Kind(er) mehr als am Morgen erfasst.</div>
                </template>
                <template v-else>
                  <div class="cp-detail-ok">Alle {{ group.morning }} Kinder anwesend.</div>
                </template>
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
  removeCheckpoint,
  summarizeCheckpoint,
  checkpointHasOpenIssues,
  getGroupChildrenBreakdown
} from '@/composables/useCheckpointsMock'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const resultSummary = ref(null)
const expandedGroupId = ref(null)
const actionError = ref(null)
const copiedList = ref(null)

const breakdown = computed(() => checkpoint.value ? getGroupChildrenBreakdown(checkpoint.value) : { present: [], absent: [] })

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

async function copyChildList(children, kind) {
  const label = kind === 'absent' ? 'Fehlend' : 'Anwesend'
  const lines = [`${label} (${children.length}):`, ...children.map(c => `- ${c.name} (G-${c.groupId})`)]

  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copiedList.value = kind
  } catch (err) {
    console.error('Fehler beim Kopieren:', err)
  }
}

async function load() {
  loading.value = true
  checkpoint.value = await fetchCheckpointDetail(Number(route.params.id))
  resultSummary.value = checkpoint.value ? await summarizeCheckpoint(checkpoint.value) : null
  loading.value = false
}

async function onFinish() {
  actionError.value = null
  const issues = await checkpointHasOpenIssues(checkpoint.value)
  if (issues.hasIssues && !confirm(`${issues.message} Trotzdem schließen?`)) {
    return
  }
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

.cp-result-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin: 4px 0 8px;
}

.cp-result-stat-present {
  font-size: 1.3rem;
  font-weight: 800;
}

.cp-result-delta {
  font-size: 0.9rem;
  font-weight: 700;
  color: #b02a37;
}

.cp-breakdown-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.cp-breakdown-block {
  flex: 1 1 200px;
}

.cp-breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  margin-bottom: 4px;
}

.cp-breakdown-absent .cp-breakdown-header {
  color: #842029;
}

.cp-breakdown-absent .cp-scroll-list {
  background-color: #f8d7da;
}

.cp-copy-btn {
  border: none;
  border-radius: 6px;
  background-color: #6c757d;
  color: #fff;
  font-size: 0.85rem;
  padding: 4px 10px;
}

.cp-scroll-list {
  max-height: 160px;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  padding: 8px 10px;
  user-select: text;
}

.cp-child-group-tag {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #495057;
  background-color: #e9ecef;
  border-radius: 6px;
  padding: 1px 6px;
  margin-left: 4px;
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

.cp-group-row-expanded {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25) inset;
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

.cp-detail-missing-label {
  color: #842029;
}

.cp-detail-extra {
  font-weight: 700;
  color: #055160;
}

.cp-detail-ok {
  font-weight: 700;
  color: #0f5132;
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
