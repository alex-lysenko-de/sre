<!-- src/components/checkpoints-prototype/ChildLink.vue -->
<!-- UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung): ein Kind wird
     ueberall (Bus-Liste, Gruppen-Liste, Checkpoint-Breakdown, Lazy-Liste,
     Scan-Historie) exakt gleich dargestellt und fuehrt immer zur selben
     Kind-Karte - vorher zeigte jede View eigene Markup-Varianten fuer
     "Name (G-x)", ohne dass ein Klick irgendwohin fuehrte. -->
<template>
  <button type="button" class="cp-entity-link" @click="$router.push(`/admin/checkpoints-prototype/child/${child.id}`)">
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
