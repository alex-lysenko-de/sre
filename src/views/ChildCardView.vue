<!-- src/views/ChildCardView.vue -->
<!-- Ticket 133 - reales Pendant zu ChildCardPrototypeView.vue (130_2,
     UX-Feedback Runde 4). Kein DebugTag/"Page N" mehr (nur fuer die
     UX-Abstimmung des Prototyps noetig).
     Ticket 151 - auf reine Checkpoint-Historie fuer heute verschlankt:
     Kindkarte (Alter/Gruppe/Schwimmabzeichen/Armband/Notizen) und
     "Bearbeiten" sind jetzt alleinige Verantwortung von /child/:id
     (ChildDetailView.vue), von wo dieser Screen per "Checkpoints
     anzeigen" erreichbar ist (single responsibility, siehe
     vault/02-Предметная-область/Checkpoint.md, "Prinzipien"). Scan-Quelle
     auf useScan().getChildScansForDate() (today-scoped) umgestellt statt
     useChildren().fetchChildDetailsAndScans() (ungefiltert, limit 50) -
     scanTypeMap-Mapping von dort hierher uebernommen. -->
<template>
  <div class="cp-child-view">
    <div class="cp-header">
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">{{ child?.name || 'Kind' }}</span>
      </div>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="child">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="me-2" />
            Scan-Historie (heute)
          </h5>

          <div v-if="!history.length" class="text-muted">Noch keine Scans.</div>
          <div v-else class="cp-history-list">
            <div v-for="event in history" :key="event.id" class="cp-history-row">
              <div class="cp-history-icon">
                <font-awesome-icon :icon="['fas', 'check-circle']" class="text-success" />
              </div>
              <div class="cp-history-body">
                <div class="cp-history-label">{{ event.resultLabel }}</div>
                <div class="cp-history-meta">
                  {{ formatTime(event.time) }}
                  <template v-if="event.betreuer"> · <BetreuerLink :betreuer="event.betreuer" /></template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="alert alert-danger">Kind nicht gefunden.</div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChildren } from '@/composables/useChildren'
import { useScan } from '@/composables/useScan'
import { getBetreuerByIds } from '@/composables/useBetreuerEntity'
import BetreuerLink from '@/components/checkpoints/BetreuerLink.vue'

const { getChildById } = useChildren()
const { getChildScansForDate } = useScan()

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const child = ref(null)
const history = ref([])

const scanTypeMap = { 1: 'Präsenz', 2: 'Bus (Einstieg)', 3: 'Bus (Ausstieg)' }

function formatTime(isoString) {
  return new Date(isoString).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  const childId = Number(route.params.id)
  child.value = await getChildById(childId)

  if (child.value) {
    const scans = await getChildScansForDate(childId)
    const betreuerMap = await getBetreuerByIds(scans.map(s => s.user_id))
    history.value = scans.map(scan => ({
      id: scan.id,
      resultLabel: scanTypeMap[scan.type] || 'Unbekannt',
      time: scan.created_at,
      betreuer: betreuerMap.get(scan.user_id) || null
    }))
  } else {
    history.value = []
  }

  loading.value = false
}

function goBack() {
  router.back()
}

watch(() => route.params.id, load)
onMounted(load)
</script>

<style scoped>
.cp-child-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
}

.cp-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.cp-header-title {
  font-size: 1.4rem;
  font-weight: 700;
  flex: 1;
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

.cp-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-history-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.cp-history-icon {
  font-size: 1.2rem;
  margin-top: 2px;
}

.cp-history-label {
  font-weight: 700;
}

.cp-history-meta {
  color: #6c757d;
  font-size: 0.9rem;
}
</style>
