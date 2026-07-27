<!-- src/components/checkpoints-prototype/CheckpointStatusBadge.vue -->
<!-- Statuspunkt+Text (OPEN/FINISHED/CANCELLED), inkl. "ueberfaellig"-Hinweis
     (day < heute && status === OPEN) und optionaler Anomalie-Markierung
     (mehrere gleichzeitig offene Checkpoints desselben Typs -
     decision.md, Punkt 6). Reiner Presentational-Baustein, siehe
     tickets/130_2/IMPLEMENTATION_PLAN.md, "Presentational-Komponenten". -->
<template>
  <span class="cp-status-wrap">
    <span class="badge cp-status-badge" :class="statusClass">
      <span class="cp-status-dot" :class="dotClass"></span>
      {{ statusLabel }}
    </span>
    <span v-if="overdue" class="badge bg-warning text-dark ms-1">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
      Überfällig
    </span>
    <span v-if="anomaly" class="badge bg-danger ms-1" title="Mehrere gleichzeitig offene Checkpoints dieses Typs">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
      Anomalie: mehrere offen
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { CHECKPOINT_STATUS, isOverdue } from '@/composables/useCheckpointsMock'

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
    case CHECKPOINT_STATUS.FINISHED: return 'Abgeschlossen'
    case CHECKPOINT_STATUS.CANCELLED: return 'Abgebrochen'
    default: return 'Unbekannt'
  }
})

const statusClass = computed(() => {
  switch (props.status) {
    case CHECKPOINT_STATUS.OPEN: return 'bg-success-subtle text-success-emphasis'
    case CHECKPOINT_STATUS.FINISHED: return 'bg-secondary-subtle text-secondary-emphasis'
    case CHECKPOINT_STATUS.CANCELLED: return 'bg-danger-subtle text-danger-emphasis'
    default: return 'bg-secondary-subtle'
  }
})

const dotClass = computed(() => {
  switch (props.status) {
    case CHECKPOINT_STATUS.OPEN: return 'bg-success'
    case CHECKPOINT_STATUS.FINISHED: return 'bg-secondary'
    case CHECKPOINT_STATUS.CANCELLED: return 'bg-danger'
    default: return 'bg-secondary'
  }
})

const overdue = computed(() => {
  if (!props.day) return false
  return isOverdue({ day: props.day, status: props.status })
})
</script>

<style scoped>
.cp-status-badge {
  font-size: 0.85rem;
  padding: 0.35rem 0.6rem;
}

.cp-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.35rem;
}
</style>
