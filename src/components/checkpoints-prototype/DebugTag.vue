<!-- src/components/checkpoints-prototype/DebugTag.vue -->
<!-- Temporaeres Debug-Label fuer die UX-Abstimmung von Ticket 130_2: macht
     Seiten ("Page N") und Elementgruppen ("elN") auf jeder Prototyp-Ansicht
     sichtbar benennbar, damit Feedback per Nummer statt per Beschreibung
     gegeben werden kann. Wird entfernt, sobald das UX abgenommen ist -
     alle Verwendungen tragen den Klassen-Praefix cp-debug-, damit sie sich
     spaeter leicht wiederfinden lassen. -->
<template>
  <span class="cp-debug-tag" :class="variant === 'page' ? 'cp-debug-tag-page' : 'cp-debug-tag-el'">
    {{ label }}
  </span>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'el' // 'page' | 'el'
  }
})
</script>

<style scoped>
.cp-debug-tag {
  font-family: monospace;
  font-weight: 700;
  border-radius: 4px;
  display: inline-block;
  line-height: 1.4;
}

.cp-debug-tag-page {
  background: #000;
  color: #0f0;
  padding: 4px 10px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.cp-debug-tag-el {
  background: #ffe08a;
  color: #7a4b00;
  padding: 0 6px;
  font-size: 0.7rem;
  margin-right: 6px;
  vertical-align: middle;
}
</style>
