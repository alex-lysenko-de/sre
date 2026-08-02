<!-- src/components/checkpoints/GroupLink.vue -->
<!-- Ticket 133 - Uebernahme aus checkpoints-prototype/GroupLink.vue,
     unveraendert bis auf den Routenpfad. Verlinkt zur tagesuebergreifenden
     Gruppen-Karte (GroupEntityView.vue), nicht zur Checkpoint-gebundenen
     Gruppenansicht (Ticket 134). -->
<template>
  <button type="button" class="cp-entity-link" @click="$router.push(`/admin/checkpoints/group-entity/${groupId}`)">
    Gruppe {{ groupId }}
  </button>
</template>

<script setup>
defineProps({
  groupId: {
    type: Number,
    required: true
  }
})
</script>

<style scoped>
.cp-entity-link {
  border: none;
  background: transparent;
  color: #0d6efd;
  font-weight: 600;
  padding: 2px 0;
  text-align: left;
  cursor: pointer;
}

.cp-entity-link:hover {
  text-decoration: underline;
}
</style>
