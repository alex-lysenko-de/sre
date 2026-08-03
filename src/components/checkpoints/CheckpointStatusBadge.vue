<!-- src/components/checkpoints/CheckpointStatusBadge.vue -->
<!-- Ticket 134 - Uebernahme aus checkpoints-prototype/CheckpointStatusBadge.vue,
     unveraendert bis auf den Import (useCheckpoints statt useCheckpointsMock). -->
<template>
  <span class="cp-status-wrap">
    <span class="badge cp-status-badge" :class="statusClass">
      <span class="cp-status-dot" :class="dotClass"></span>
      {{ statusLabel }}
    </span>
    <span v-if="overdue" class="badge bg-warning text-dark ms-1 cp-status-badge">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-1" />
      Überfällig
    </span>
    <span v-if="anomaly" class="badge bg-danger ms-1 cp-status-badge" title="Mehrere gleichzeitig offene Checkpoints dieses Typs">
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

const statusClass = computed(() => {
  switch (props.status) {
    case CHECKPOINT_STATUS.OPEN: return 'bg-success-subtle text-success-emphasis'
    case CHECKPOINT_STATUS.FINISHED: return 'bg-secondary-subtle text-secondary-emphasis'
    default: return 'bg-secondary-subtle'
  }
})

const dotClass = computed(() => {
  switch (props.status) {
    case CHECKPOINT_STATUS.OPEN: return 'bg-success'
    case CHECKPOINT_STATUS.FINISHED: return 'bg-secondary'
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
  font-size: 1.15rem;
  font-weight: 800;
  padding: 0.5rem 0.9rem;
}

.cp-status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 0.4rem;
}
</style>
