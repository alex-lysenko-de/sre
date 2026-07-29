<!-- src/components/checkpoints/BetreuerLink.vue -->
<!-- Gegenstueck zu ChildLink.vue fuer Betreuer. Admins haben keine
     Betreuer-Karte/Route und werden als einfacher, nicht anklickbarer Text
     dargestellt. Ported unchanged from the 130_2 prototype. -->
<template>
  <span v-if="betreuer?.isAdmin" class="cp-entity-link-static">{{ betreuer.name }}</span>
  <button v-else type="button" class="cp-entity-link" @click="$router.push(`/admin/checkpoints/betreuer/${betreuer.id}`)">
    {{ betreuer?.name }}
  </button>
</template>

<script setup>
defineProps({
  betreuer: {
    type: Object,
    default: null
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

.cp-entity-link-static {
  font-weight: 600;
  color: #495057;
}
</style>
