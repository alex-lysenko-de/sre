<!-- src/views/CheckpointChildCardView.vue -->
<!-- Ticket 131 - reale Kind-Karte. Ported from the 130_2 prototype
     (ChildCardPrototypeView.vue), aber mit einer bewussten Kuerzung: die
     mock-erfundenen Felder Eltern/Telefon haben keine reale Entsprechung in
     `children` und werden hier nicht angezeigt (siehe tickets/131/
     IMPLEMENTATION_PLAN.md, "Grenzen dieser Sitzung"). Reale Felder decken
     sich exakt mit ChildDetailView.vue (age, schwimmer, band_id, notes).

     Realer Gewinn gegenueber dem Mock: die Scan-Historie kommt direkt aus
     useChildren.fetchChildDetailsAndScans() (echte `scans`-Tabelle, bisher
     von keinem Bildschirm genutzt) statt einer synthetisierten
     Annaeherung - echte Historie, nicht auf heutige Checkpoints beschraenkt. -->
<template>
  <div class="cp-child-view">
    <div class="cp-header">
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">{{ child?.name || 'Kind' }}</span>
        <button v-if="child" class="btn btn-primary cp-edit-btn" @click="router.push(`/child-edit/${child.id}`)">
          <font-awesome-icon :icon="['fas', 'pen']" class="me-1" />
          Bearbeiten
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="child">
      <div class="card mb-3">
        <div class="card-body">
          <div class="cp-info-grid">
            <div class="cp-info-item">
              <div class="cp-info-label">Alter</div>
              <div class="cp-info-value">{{ child.age }} Jahre</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Gruppe</div>
              <div class="cp-info-value"><GroupLink :group-id="child.group_id" /></div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Schwimmabzeichen</div>
              <div class="cp-info-value">
                <span class="badge" :class="Utils.getSwimBadgeClass(child.schwimmer)">{{ Utils.getSwimLevel(child.schwimmer) }}</span>
              </div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Armband</div>
              <div class="cp-info-value">{{ child.band_id || '—' }}</div>
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
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="me-2" />
            Scan-Historie
          </h5>

          <div v-if="!history.length" class="text-muted">Noch keine Scans.</div>
          <div v-else class="cp-history-list">
            <div v-for="event in history" :key="event.id" class="cp-history-row">
              <div class="cp-history-icon">
                <font-awesome-icon :icon="['fas', 'check-circle']" class="text-success" />
              </div>
              <div class="cp-history-body">
                <div class="cp-history-label">{{ event.type_name }}</div>
                <div class="cp-history-meta">
                  {{ formatTime(event.created_at) }}
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
import { supabase } from '@/supabase'
import { useChildren } from '@/composables/useChildren'
import GroupLink from '@/components/checkpoints/GroupLink.vue'
import BetreuerLink from '@/components/checkpoints/BetreuerLink.vue'
import Utils from '@/utils/utils'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const child = ref(null)
const history = ref([])

function formatTime(isoString) {
  return new Date(isoString).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function enrichWithAuthors(scans) {
  const userIds = Array.from(new Set(scans.map(s => s.user_id).filter(id => id != null)))
  if (!userIds.length) return scans.map(s => ({ ...s, betreuer: null }))

  const { data, error } = await supabase.from('users').select('id, display_name').in('id', userIds)
  if (error) {
    console.error('Fehler beim Laden der Scan-Autoren:', error)
    return scans.map(s => ({ ...s, betreuer: null }))
  }

  const byId = new Map(data.map(u => [u.id, u]))
  return scans.map(s => ({
    ...s,
    betreuer: s.user_id != null && byId.has(s.user_id) ? { id: s.user_id, name: byId.get(s.user_id).display_name } : null
  }))
}

async function load() {
  loading.value = true
  const { fetchChildDetailsAndScans } = useChildren()
  try {
    const { child: childData, scans } = await fetchChildDetailsAndScans(Number(route.params.id))
    child.value = childData
    history.value = await enrichWithAuthors(scans)
  } catch (err) {
    console.error('Fehler beim Laden der Kind-Karte:', err)
    child.value = null
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
