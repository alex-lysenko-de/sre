<!-- src/views/CheckpointGroupEntityView.vue -->
<!-- Ticket 131 - reale, Checkpoint-uebergreifende Gruppen-Karte. Ported from
     the 130_2 prototype (GroupEntityPrototypeView.vue) - Datenquelle
     wechselt auf useGroupEntity.js (echte Supabase-Abfragen), DebugTag
     entfernt. -->
<template>
  <div class="cp-group-entity-view">
    <div class="cp-header-top">
      <button class="cp-back-btn me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <span class="cp-header-title">Gruppe {{ groupId }}</span>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="entity">
      <div class="card mb-3">
        <div class="card-body">
          <h5 class="card-title">Aktuelles Ergebnis</h5>
          <template v-if="entity.currentResult">
            <button type="button" class="cp-current-result" @click="goToCheckpointGroup(entity.currentResult.checkpointId)">
              {{ entity.currentResult.current }} / {{ entity.currentResult.morning }}
              <span class="cp-current-result-meta">GROUP Checkpoint #{{ entity.currentResult.seq }}</span>
            </button>
          </template>
          <div v-else class="text-muted">Heute noch keine Group-Checkpoint für diese Gruppe.</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'child']" class="me-2" />
            Kinder
          </h5>
          <EntityListCard :items="entity.children" kind="child" :show-copy="true" empty-text="Keine Kinder in dieser Gruppe." />

          <hr>

          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'user']" class="me-2" />
            Betreuer
          </h5>
          <EntityListCard :items="entity.betreuer" kind="betreuer" :show-copy="false" empty-text="Heute keine Betreuer zugeordnet." />
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h5 class="card-title">
            <font-awesome-icon :icon="['fas', 'clock-rotate-left']" class="me-2" />
            Tageshistorie
          </h5>
          <div v-if="!entity.dayHistory.length" class="text-muted">Heute noch keine Einträge.</div>
          <div v-else class="cp-history-list">
            <div v-for="entry in entity.dayHistory" :key="entry.checkpointId" class="cp-history-row" role="button" @click="goToCheckpointGroup(entry.checkpointId)">
              <div class="cp-history-body">
                <div class="cp-history-label">
                  {{ formatTime(entry.time) }} — {{ entry.morning }} → {{ entry.current }}
                  <span :class="`cp-history-status-${entry.status}`">{{ statusLabel(entry.status) }}</span>
                </div>
                <div class="cp-history-meta">GROUP Checkpoint #{{ entry.seq }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchGroupEntity } from '@/composables/useGroupEntity'
import EntityListCard from '@/components/checkpoints/EntityListCard.vue'

const route = useRoute()
const router = useRouter()

const groupId = computed(() => Number(route.params.id))
const loading = ref(true)
const entity = ref(null)

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status) {
  return { ok: 'OK', missing: 'Fehlen', extra: 'Mehr', none: 'Keine Daten' }[status] || status
}

async function load() {
  loading.value = true
  entity.value = await fetchGroupEntity(groupId.value)
  loading.value = false
}

function goToCheckpointGroup(checkpointId) {
  router.push(`/admin/checkpoints/group/${checkpointId}`)
}

function goBack() {
  router.back()
}

onMounted(load)
</script>

<style scoped>
.cp-group-entity-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
}

.cp-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.cp-header-title {
  font-size: 1.4rem;
  font-weight: 700;
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

.cp-current-result {
  border: none;
  background-color: #e7f1ff;
  color: #084298;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 1.4rem;
  font-weight: 800;
  cursor: pointer;
}

.cp-current-result-meta {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
}

.cp-history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-history-row {
  padding: 8px;
  border-radius: 8px;
  background-color: #f8f9fa;
  cursor: pointer;
}

.cp-history-label {
  font-weight: 700;
}

.cp-history-meta {
  color: #6c757d;
  font-size: 0.9rem;
}

.cp-history-status-ok {
  color: #0f5132;
}

.cp-history-status-missing {
  color: #842029;
}

.cp-history-status-extra {
  color: #055160;
}

.cp-history-status-none {
  color: #495057;
}
</style>
