<!-- src/views/BetreuerCardPrototypeView.vue -->
<!-- Ticket 130_2 - UX-Feedback Runde 4, Punkt 7: neue Entitaet "Betreuer" -
     Name, E-Mail, Telefon, heutige Gruppe (als Link) und aktueller Bus
     (falls zutreffend, Link zur Bus-Checkpoint, da Busse keine eigene
     Entity-Route haben - siehe Plan, "Kein eigener Bus-Entity-Route").
     Ausschliesslich Mock-Daten. -->
<template>
  <div class="cp-betreuer-view">
    <DebugTag variant="page" label="Page 8" />

    <div class="cp-header-top">
      <DebugTag label="el1" />
      <button class="cp-back-btn me-2" @click="goBack">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <span class="cp-header-title">{{ betreuer?.name || 'Betreuer' }}</span>
    </div>

    <template v-if="betreuer">
      <div class="card">
        <div class="card-body">
          <DebugTag label="el2" />
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getBetreuerById } from '@/composables/useBetreuerEntityMock'
import { getBetreuerTodayAssignment } from '@/composables/useCheckpointsMock'
import GroupLink from '@/components/checkpoints-prototype/GroupLink.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const route = useRoute()
const router = useRouter()

const betreuer = computed(() => getBetreuerById(Number(route.params.id)))
const assignment = ref({ busNumber: null, busCheckpointId: null, groupId: null, groupCheckpointId: null })

function load() {
  assignment.value = betreuer.value ? getBetreuerTodayAssignment(betreuer.value.id) : assignment.value
}

function goToBus() {
  router.push(`/admin/checkpoints-prototype/bus/${assignment.value.busCheckpointId}`)
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
