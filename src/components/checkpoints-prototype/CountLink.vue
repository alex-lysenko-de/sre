<!-- src/components/checkpoints-prototype/CountLink.vue -->
<!-- Presentational-Baustein fuer eine anklickbare Kennzahl ("36 Kinder",
     "5 Betreuer", "2 fehlen") - UX-Feedback Runde 4, Punkt 3: "Alle
     quantitativen Kennzahlen sind Links. Beim Klick oeffnet sich die
     entsprechende Liste." Entscheidet nicht selbst, wohin der Klick fuehrt
     (kein Router-Aufruf hier) - die aufrufende View reicht das per @click
     durch, da Ziel/Query je nach Kontext (Bus/Gruppe/Checkpoint) variieren. -->
<template>
  <button type="button" class="cp-count-link" :class="variantClass" @click="$emit('click')">
    <font-awesome-icon v-if="icon" :icon="icon" class="me-1" />
    <span class="cp-count-link-number">{{ count }}</span>
    <span v-if="label" class="cp-count-link-label">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: {
    type: [Number, String],
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  icon: {
    type: Array,
    default: null
  },
  variant: {
    type: String,
    default: 'default' // 'default' | 'kinder' | 'betreuer' | 'warning'
  }
})

const variantClass = computed(() => `cp-count-link-${props.variant}`)
</script>

<style scoped>
.cp-count-link {
  border: none;
  background: transparent;
  padding: 2px 4px;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.cp-count-link:hover {
  text-decoration: underline;
}

.cp-count-link-number {
  font-size: 1.25rem;
}

.cp-count-link-label {
  font-size: 0.85rem;
  font-weight: 700;
}

.cp-count-link-default {
  color: #212529;
}

.cp-count-link-kinder {
  color: #0d6efd;
}

.cp-count-link-betreuer {
  color: #dc3545;
}

.cp-count-link-warning {
  color: #b02a37;
}
</style>
