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

     UX-Feedback Runde 2:
     - EL1/EL2: Status und Schliessen/Oeffnen stehen jetzt nebeneinander in
       einer Zeile; Entfernen ist ein kleiner Icon-Button neben dem Titel
       (seltene, gefaehrliche Aktion - soll nicht dominieren).

     UX-Feedback Runde 3:
     - EL2: zeigt jetzt zusaetzlich das Ergebnis (anwesend/gesamt) und die
       Abweichung zur Tagesbasis (summarizeCheckpoint()).
     - Schliessen warnt jetzt vorher bei fehlenden Kindern oder Gruppen ohne
       Daten (checkpointHasOpenIssues()).

     UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung):
     - Das vormalige Akkordeon (Gruppen-Reihe klappt beim Anklicken inline
       auf) entfaellt: die Gruppennummer ist jetzt ein GroupLink (fuehrt zur
       neuen, tagesuebergreifenden Gruppen-Karte, GroupEntityPrototypeView),
       die Kinderzahl ein CountLink (fuehrt zur universellen Liste,
       EntityListPrototypeView) - Detailinformationen leben jetzt auf diesen
       eigenen Entitaeten-Seiten statt redundant inline auf dieser Seite.
     - Die vormalige "Kinder gesamt"-Breakdown-Karte mit Kopieren-Buttons ist
       durch eine CountLink-Zeile ersetzt (Anwesend/Fehlend/Betreuer gesamt),
       analog zur Bus-Checkpoint-Seite. -->
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
          <CountLink :count="`${resultSummary.present} / ${resultSummary.total}`" :icon="['fas', 'child']" variant="default" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'present' })" />
          <template v-if="!resultSummary.isBaselineCheckpoint && (resultSummary.missing > 0 || resultSummary.extra > 0)">
            <CountLink v-if="resultSummary.missing > 0" :count="resultSummary.missing" label="fehlen" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'missing' })" />
            <CountLink v-if="resultSummary.extra > 0" :count="resultSummary.extra" label="mehr" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'extra' })" />
          </template>
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
          <h5 class="card-title">Kinder &amp; Betreuer gesamt</h5>
          <div class="cp-aggregate-row">
            <CountLink :count="breakdownCounts.present" label="Anwesend" :icon="['fas', 'child']" variant="kinder" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'present' })" />
            <CountLink :count="breakdownCounts.absent" label="Fehlend" :icon="['fas', 'exclamation-triangle']" variant="warning" @click="openList({ kind: 'child', scope: 'checkpoint', filter: 'absent' })" />
            <CountLink :count="breakdownCounts.betreuer" label="Betreuer" :icon="['fas', 'user']" variant="betreuer" @click="openList({ kind: 'betreuer', scope: 'checkpoint' })" />
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

          <div class="cp-group-list">
            <div
                v-for="group in checkpoint.groups"
                :key="group.groupId"
                class="cp-group-row"
                :class="groupCardClass(group)"
            >
              <GroupLink :group-id="group.groupId" />

              <template v-if="!group.hasData">
                <span class="cp-group-row-status">
                  <font-awesome-icon :icon="['fas', 'info-circle']" class="me-1" />
                  Keine Daten
                </span>
              </template>
              <template v-else>
                <CountLink :count="group.current" label="Kinder" variant="default" @click="openList({ kind: 'child', scope: 'group', scopeId: group.groupId, filter: 'present' })" />
                <CountLink v-if="group.current < group.morning" :count="group.morning - group.current" label="fehlen" variant="warning" @click="openList({ kind: 'child', scope: 'group', scopeId: group.groupId, filter: 'absent' })" />
                <span v-else-if="group.current > group.morning" class="cp-group-row-status cp-detail-extra">
                  +{{ group.current - group.morning }} mehr
                </span>
                <span v-else class="cp-group-row-status cp-detail-ok">
                  <font-awesome-icon :icon="['fas', 'check-circle']" class="me-1" />
                  OK
                </span>
              </template>
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
  getGroupChildrenBreakdown,
  getCheckpointBetreuerList
} from '@/composables/useCheckpointsMock'
import CheckpointStatusBadge from '@/components/checkpoints-prototype/CheckpointStatusBadge.vue'
import CheckpointOriginBadge from '@/components/checkpoints-prototype/CheckpointOriginBadge.vue'
import CountLink from '@/components/checkpoints-prototype/CountLink.vue'
import GroupLink from '@/components/checkpoints-prototype/GroupLink.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const OPEN = CHECKPOINT_STATUS.OPEN

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const resultSummary = ref(null)
const actionError = ref(null)

const breakdownCounts = computed(() => {
  if (!checkpoint.value) return { present: 0, absent: 0, betreuer: 0 }
  const breakdown = getGroupChildrenBreakdown(checkpoint.value)
  return {
    present: breakdown.present.length,
    absent: breakdown.absent.length,
    betreuer: getCheckpointBetreuerList(checkpoint.value).length
  }
})

function groupCardClass(group) {
  if (!group.hasData) return 'cp-group-card-none'
  if (group.current === group.morning) return 'cp-group-card-ok'
  if (group.current < group.morning) return 'cp-group-card-missing'
  return 'cp-group-card-extra'
}

function openList({ kind, scope, scopeId, filter }) {
  const query = { kind, scope, checkpointId: String(checkpoint.value.id) }
  if (scopeId != null) query.scopeId = String(scopeId)
  if (filter) query.filter = filter
  router.push({ path: '/admin/checkpoints-prototype/list', query })
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

.cp-aggregate-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
}

.cp-group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.cp-group-row {
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
}

.cp-group-row-status {
  font-size: 0.95rem;
  font-weight: 700;
}

.cp-detail-extra {
  color: #055160;
}

.cp-detail-ok {
  color: #0f5132;
}

.cp-group-card-ok {
  background-color: #d1e7dd;
}

.cp-group-card-missing {
  background-color: #f8d7da;
}

.cp-group-card-extra {
  background-color: #cff4fc;
}

.cp-group-card-none {
  background-color: #e9ecef;
}
</style>
