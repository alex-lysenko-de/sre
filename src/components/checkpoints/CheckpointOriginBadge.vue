<!-- src/components/checkpoints/CheckpointOriginBadge.vue -->
<!-- Unterscheidet "automatisch erstellt (Betreuer X)" von "durch Admin
     erstellt" anhand von created_by. Ported from the 130_2 prototype -
     BetreuerLink now points to the real Betreuer-Karte
     (tickets/131/IMPLEMENTATION_PLAN.md). -->
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
