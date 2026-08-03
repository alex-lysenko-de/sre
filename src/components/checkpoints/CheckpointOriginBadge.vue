<!-- src/components/checkpoints/CheckpointOriginBadge.vue -->
<!-- Ticket 134 - Uebernahme aus checkpoints-prototype/CheckpointOriginBadge.vue,
     unveraendert (der BetreuerLink-Import zeigt bereits relativ auf die
     eigene Komponente im selben Ordner). -->
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
