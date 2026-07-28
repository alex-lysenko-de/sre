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
       Gesamtliste, damit man gezielt eine Gruppe durchsuchen kann.

     UX-Feedback Runde 2:
     - EL1/EL2: Status und Schliessen/Oeffnen stehen jetzt nebeneinander in
       einer Zeile; Entfernen ist ein kleiner Icon-Button neben dem Titel
       statt eines grossen Buttons. EL3/EL4/EL5 inhaltlich unveraendert.

     UX-Feedback Runde 3:
     - EL2: zeigt jetzt zusaetzlich das Ergebnis (gemeldet/gesamt) und die
       Abweichung zur Tagesbasis (summarizeCheckpoint()).
     - Schliessen warnt jetzt vorher, falls noch Kinder nicht gemeldet sind
       (checkpointHasOpenIssues()).
     - EL4/EL5 haben jetzt je einen Kopieren-Button fuer die Gemeldet-/
       Noch-nicht-gemeldet-Liste. -->
<template>
  <div class="cp-detail-view">
    <DebugTag variant="page" label="Page 4" />

    <div class="cp-header">
      <DebugTag label="el1" />
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
            Es ist bereits ein anderer Lazy-Checkpoint offen (#{{ actionError.existingId }}). Zuerst diesen schließen.
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
        <div class="card-body text-center">
          <DebugTag label="el3" />
          <div class="text-muted">Letzte Meldung</div>
          <div class="cp-last-scan">{{ progress?.lastScanAt ? formatTime(progress.lastScanAt) : '—' }}</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <DebugTag label="el4" />
          <div class="cp-list-header">
            <h5 class="card-title mb-0">
              <font-awesome-icon :icon="['fas', 'check-circle']" class="me-2 text-success" />
              Gemeldet ({{ progress?.checkedIn.length || 0 }})
            </h5>
            <button class="btn btn-sm cp-copy-btn" @click="copyChildList(progress?.checkedIn || [], 'present')">
              {{ copiedList === 'present' ? 'Kopiert!' : 'Kopieren' }}
            </button>
          </div>
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
          <div class="cp-list-header">
            <h5 class="card-title mb-0">
              <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2 text-warning" />
              Noch nicht gemeldet ({{ progress?.notYet.length || 0 }})
            </h5>
            <button
                v-if="progress?.notYet.length"
                class="btn btn-sm cp-copy-btn"
                @click="copyChildList(progress?.notYet || [], 'absent')"
            >
              {{ copiedList === 'absent' ? 'Kopiert!' : 'Kopieren' }}
            </button>
          </div>
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
  removeCheckpoint,
  summarizeCheckpoint,
  checkpointHasOpenIssues
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
const resultSummary = ref(null)
const actionError = ref(null)
const copiedList = ref(null)

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

async function copyChildList(children, kind) {
  const label = kind === 'absent' ? 'Noch nicht gemeldet' : 'Gemeldet'
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
  const id = Number(route.params.id)
  checkpoint.value = await fetchCheckpointDetail(id)
  if (checkpoint.value) {
    progress.value = await fetchLazyCheckpointProgress(id)
    resultSummary.value = await summarizeCheckpoint(checkpoint.value)
  }
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

.cp-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.cp-copy-btn {
  border: none;
  border-radius: 6px;
  background-color: #6c757d;
  color: #fff;
  font-size: 0.85rem;
  padding: 4px 10px;
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
