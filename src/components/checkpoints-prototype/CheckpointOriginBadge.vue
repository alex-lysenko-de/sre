<!-- src/components/checkpoints-prototype/CheckpointOriginBadge.vue -->
<!-- Unterscheidet "automatisch erstellt (Betreuer X)" von "durch Admin
     erstellt" anhand von created_by - explizite Anforderung aus 130_2.txt
     und im 130-Plan als Risiko festgehalten (leicht zu vergessen, da es in
     den bestehenden Bildschirmen keine Entsprechung gibt). Reiner
     Presentational-Baustein.

     UX-Feedback Runde 4: der Betreuer-Name ist jetzt ein BetreuerLink (fuehrt
     zur neuen Betreuer-Karte) - Admins haben keine Karte und bleiben Text. -->
<template>
  <span class="badge cp-origin-badge" :class="createdBy?.isAdmin ? 'bg-warning text-dark' : 'bg-light text-dark border'">
    <font-awesome-icon :icon="['fas', 'user']" class="me-1" />
    <template v-if="createdBy?.isAdmin">
      Admin
    </template>
    <template v-else>
      Auto (<BetreuerLink :betreuer="createdBy" />)
    </template>
  </span>
</template>

<script setup>
import BetreuerLink from './BetreuerLink.vue'

defineProps({
  createdBy: {
    type: Object,
    default: null
  }
})
</script>

<style scoped>
.cp-origin-badge {
  font-size: 1rem;
  font-weight: 700;
  padding: 0.5rem 0.8rem;
}
</style>
