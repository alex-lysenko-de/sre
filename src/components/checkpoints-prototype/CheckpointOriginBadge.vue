<!-- src/components/checkpoints-prototype/CheckpointOriginBadge.vue -->
<!-- Unterscheidet "automatisch erstellt (Betreuer X)" von "durch Admin
     erstellt" anhand von created_by - explizite Anforderung aus 130_2.txt
     und im 130-Plan als Risiko festgehalten (leicht zu vergessen, da es in
     den bestehenden Bildschirmen keine Entsprechung gibt). Reiner
     Presentational-Baustein. -->
<template>
  <span class="badge" :class="createdBy?.isAdmin ? 'bg-warning text-dark' : 'bg-light text-dark border'">
    <font-awesome-icon :icon="['fas', 'user']" class="me-1" />
    <template v-if="createdBy?.isAdmin">
      Admin
    </template>
    <template v-else>
      Auto ({{ createdBy?.name || 'unbekannt' }})
    </template>
  </span>
</template>

<script setup>
defineProps({
  createdBy: {
    type: Object,
    default: null
  }
})
</script>
