<!-- src/components/checkpoints-prototype/BetreuerLink.vue -->
<!-- Gegenstueck zu ChildLink.vue fuer Betreuer (UX-Feedback Runde 4).
     Admins haben keine Betreuer-Karte/Route (siehe useBetreuerEntityMock.js
     - ADMIN_USER ist bewusst kein Teil des Rosters) und werden daher als
     einfacher, nicht anklickbarer Text dargestellt. -->
<template>
  <span v-if="betreuer?.isAdmin" class="cp-entity-link-static">{{ betreuer.name }}</span>
  <button v-else type="button" class="cp-entity-link" @click="$router.push(`/admin/checkpoints-prototype/betreuer/${betreuer.id}`)">
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
