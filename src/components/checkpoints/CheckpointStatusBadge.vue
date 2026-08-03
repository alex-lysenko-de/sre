<!-- src/components/checkpoints/CheckpointStatusBadge.vue -->
<!-- Ticket 134 - Uebernahme aus checkpoints-prototype/CheckpointStatusBadge.vue.
     Ticket 140, Punkt 3: der Haupt-Status ("Offen"/"Geschlossen") ist kein
     Badge/Quadrat mehr (wirkte wie ein Button) - normaler Text, Farbe nur
     noch auf dem Wort selbst. Ueberfaellig/Anomalie bleiben Badges (in
     140.txt nicht genannt, sind echte Warnungen und werden nicht mit einem
     Button verwechselt). -->
<template>
  <span class="cp-status-wrap">
    <span class="cp-status-line">
      Status: <b :class="statusTextClass">{{ statusLabel }}</b>
    </span>
    <span v-if="overdue" class="badge bg-warning text-dark ms-1 cp-status-extra-badge">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
      Überfällig
    </span>
    <span v-if="anomaly" class="badge bg-danger ms-1 cp-status-extra-badge" title="Mehrere gleichzeitig offene Checkpoints dieses Typs">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
      Anomalie: mehrere offen
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { CHECKPOINT_STATUS, isOverdue } from '@/composables/useCheckpoints'

const props = defineProps({
  status: {
    type: Number,
    required: true
  },
  day: {
    type: String,
    default: null
  },
  anomaly: {
    type: Boolean,
    default: false
  }
})

const statusLabel = computed(() => {
  switch (props.status) {
    case CHECKPOINT_STATUS.OPEN: return 'Offen'
    case CHECKPOINT_STATUS.FINISHED: return 'Geschlossen'
    default: return 'Unbekannt'
  }
})

const statusTextClass = computed(() => {
  switch (props.status) {
    case CHECKPOINT_STATUS.OPEN: return 'cp-status-text-open'
    case CHECKPOINT_STATUS.FINISHED: return 'cp-status-text-finished'
    default: return ''
  }
})

const overdue = computed(() => {
  if (!props.day) return false
  return isOverdue({ day: props.day, status: props.status })
})
</script>

<style scoped>
.cp-status-line {
  font-size: 1.05rem;
  font-weight: 600;
  color: #495057;
}

.cp-status-text-open {
  color: #198754;
}

.cp-status-text-finished {
  color: #6c757d;
}

.cp-status-extra-badge {
  font-size: 1rem;
  font-weight: 700;
  padding: 0.4rem 0.7rem;
}
</style>
