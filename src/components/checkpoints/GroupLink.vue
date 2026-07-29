<!-- src/components/checkpoints/GroupLink.vue -->
<!-- Verlinkt eine Gruppennummer zur Checkpoint-uebergreifenden Gruppen-Karte
     (/admin/checkpoints/group-entity/:id) - zu unterscheiden von der
     Checkpoint-gebundenen Gruppenansicht (/admin/checkpoints/group/:id).
     Ported unchanged from the 130_2 prototype. -->
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
