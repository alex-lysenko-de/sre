<!-- src/components/checkpoints/CheckpointOriginBadge.vue -->
<!-- Ticket 134 - Uebernahme aus checkpoints-prototype/CheckpointOriginBadge.vue.
     Ticket 140, Punkt 3: kein Badge/Quadrat mehr (wirkte wie ein Button) -
     normaler Text. Immer der echte Name des Erstellers (auch wenn er ein
     Admin/HauptBetreuer ist) - BetreuerLink.vue unterscheidet isAdmin
     bereits selbst (statischer Text vs. anklickbarer Link), daher genuegt
     ein unbedingter Aufruf statt der bisherigen "Admin"-Sonderbehandlung. -->
<template>
  <span class="cp-origin-line">
    Ersteller: <b><BetreuerLink :betreuer="createdBy" /></b>
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
.cp-origin-line {
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
}
</style>
