<!-- src/views/ChildCardPrototypeView.vue -->
<!-- Ticket 130_2 - UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung),
     Punkt 5: neue Entitaet "Kind" - eine Karte mit allen verfuegbaren
     Informationen (Vorname, Nachname, Alter, Gruppe, Eltern, Telefone,
     Armband, Notizen), einem Edit-Button und der vollstaendigen
     Scan-Historie des Tages. Feldauswahl orientiert sich an
     ChildDetailView.vue (age, schwimmer, band_id, notes), Zusatzfelder
     (Eltern/Telefon) sind fuer den Prototyp erfunden (siehe
     useChildEntityMock.js). Ausschliesslich Mock-Daten. -->
<template>
  <div class="cp-child-view">
    <DebugTag variant="page" label="Page 6" />

    <div class="cp-header">
      <DebugTag label="el1" />
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">{{ child?.name || 'Kind' }}</span>
        <button v-if="child" class="btn btn-primary cp-edit-btn" @click="router.push(`/admin/checkpoints-prototype/child/${child.id}/edit`)">
          <font-awesome-icon :icon="['fas', 'pen']" class="me-1" />
          Bearbeiten
        </button>
      </div>
    </div>

    <template v-if="child">
      <div class="card mb-3">
        <div class="card-body">
          <DebugTag label="el2" />
          <div class="cp-info-grid">
            <div class="cp-info-item">
              <div class="cp-info-label">Alter</div>
              <div class="cp-info-value">{{ child.age }} Jahre</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Gruppe</div>
              <div class="cp-info-value"><GroupLink :group-id="child.groupId" /></div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Schwimmabzeichen</div>
              <div class="cp-info-value">
                <span class="badge" :class="Utils.getSwimBadgeClass(child.schwimmer)">{{ Utils.getSwimLevel(child.schwimmer) }}</span>
              </div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Armband</div>
              <div class="cp-info-value">{{ child.band_id }}</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Erziehungsberechtigte</div>
              <div class="cp-info-value">{{ child.parentA }}<template v-if="child.parentB"><br>{{ child.parentB }}</template></div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Telefon</div>
              <div class="cp-info-value">{{ child.phone }}</div>
            </div>
            <div class="cp-info-item cp-info-item-wide">
              <div class="cp-info-label">Notizen</div>
              <div class="cp-info-value">{{ child.notes || '—' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <DebugTag label="el3" />
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="me-2" />
            Scan-Historie (heute)
          </h5>

          <div v-if="!history.length" class="text-muted">Noch keine Scans heute.</div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getChildById } from '@/composables/useChildEntityMock'
import { getChildScanHistoryToday } from '@/composables/useScanHistoryMock'
import GroupLink from '@/components/checkpoints-prototype/GroupLink.vue'
import BetreuerLink from '@/components/checkpoints-prototype/BetreuerLink.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'
import Utils from '@/utils/utils'

const route = useRoute()
const router = useRouter()

const child = computed(() => getChildById(Number(route.params.id)))
const history = ref([])

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  history.value = child.value ? await getChildScanHistoryToday(child.value.id) : []
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

.cp-edit-btn {
  font-weight: 700;
}

.cp-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.cp-info-item-wide {
  grid-column: 1 / -1;
}

.cp-info-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #6c757d;
  text-transform: uppercase;
}

.cp-info-value {
  font-size: 1.1rem;
  font-weight: 600;
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
