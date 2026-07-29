<!-- src/views/CheckpointBetreuerCardView.vue -->
<!-- Ticket 131 - reale Betreuer-Karte. Ported from the 130_2 prototype
     (BetreuerCardPrototypeView.vue) - Name/E-Mail/Telefon aus der echten
     `users`-Tabelle, heutige Zuordnung aus
     useCheckpoints.getBetreuerTodayAssignment() (echte scan_packets-Abfrage). -->
<template>
  <div class="cp-betreuer-view">
    <div class="cp-header-top">
      <button class="cp-back-btn me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <span class="cp-header-title">{{ betreuer?.display_name || 'Betreuer' }}</span>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else-if="betreuer">
      <div class="card">
        <div class="card-body">
          <div class="cp-info-grid">
            <div class="cp-info-item">
              <div class="cp-info-label">E-Mail</div>
              <div class="cp-info-value">{{ betreuer.email }}</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Telefon</div>
              <div class="cp-info-value">{{ betreuer.phone || '—' }}</div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Heutige Gruppe</div>
              <div class="cp-info-value">
                <GroupLink v-if="assignment.groupId != null" :group-id="assignment.groupId" />
                <span v-else class="text-muted">—</span>
              </div>
            </div>
            <div class="cp-info-item">
              <div class="cp-info-label">Aktueller Bus</div>
              <div class="cp-info-value">
                <button v-if="assignment.busNumber != null" type="button" class="cp-entity-link" @click="goToBus">
                  Bus {{ assignment.busNumber }}
                </button>
                <span v-else class="text-muted">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="alert alert-danger">Betreuer nicht gefunden.</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { getBetreuerTodayAssignment } from '@/composables/useCheckpoints'
import GroupLink from '@/components/checkpoints/GroupLink.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const betreuer = ref(null)
const assignment = ref({ busNumber: null, busCheckpointId: null, groupId: null, groupCheckpointId: null })

async function load() {
  loading.value = true
  const id = Number(route.params.id)

  const { data, error } = await supabase
      .from('users')
      .select('id, display_name, email, phone')
      .eq('id', id)
      .maybeSingle()

  if (error) {
    console.error('Fehler beim Laden des Betreuers:', error)
  }
  betreuer.value = data

  assignment.value = betreuer.value ? await getBetreuerTodayAssignment(betreuer.value.id) : assignment.value
  loading.value = false
}

function goToBus() {
  router.push(`/admin/checkpoints/bus/${assignment.value.busCheckpointId}`)
}

function goBack() {
  router.back()
}

onMounted(load)
</script>

<style scoped>
.cp-betreuer-view {
  max-width: 700px;
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

.cp-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
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

.cp-entity-link {
  border: none;
  background: transparent;
  color: #0d6efd;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
}

.cp-entity-link:hover {
  text-decoration: underline;
}
</style>
