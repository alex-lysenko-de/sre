<!-- src/components/checkpoints/ChildLink.vue -->
<!-- Ticket 133 - Uebernahme aus checkpoints-prototype/ChildLink.vue,
     unveraendert bis auf den Routenpfad (ohne -prototype-Suffix).
     Ticket 151 - Ziel auf /child/:id (vereinheitlichte Kindkarte)
     umgestellt, Checkpoint-Detailansicht ist von dort per Button erreichbar. -->
<template>
  <button type="button" class="cp-entity-link" @click="$router.push(`/child/${child.id}`)">
    {{ child.name }}
    <span v-if="child.groupId != null" class="cp-entity-link-tag">G-{{ child.groupId }}</span>
  </button>
</template>

<script setup>
defineProps({
  child: {
    type: Object,
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

.cp-entity-link-tag {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #495057;
  background-color: #e9ecef;
  border-radius: 6px;
  padding: 1px 6px;
  margin-left: 4px;
}
</style>
