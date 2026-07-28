<!-- src/components/checkpoints-prototype/GroupLink.vue -->
<!-- Verlinkt eine Gruppennummer zur neuen, Checkpoint-uebergreifenden
     Gruppen-Karte (UX-Feedback Runde 4, Punkt 7/8) - zu unterscheiden von
     der bestehenden, Checkpoint-gebundenen Gruppenansicht
     (/admin/checkpoints-prototype/group/:id, Page 3). -->
<template>
  <button type="button" class="cp-entity-link" @click="$router.push(`/admin/checkpoints-prototype/group-entity/${groupId}`)">
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
