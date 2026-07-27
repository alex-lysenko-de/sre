<!-- src/components/checkpoints-prototype/CheckpointTypeBadge.vue -->
<!-- Icon + Beschriftung fuer den Checkpoint-Typ (Bus/Group/Lazy). Reiner
     Presentational-Baustein des Ticket-130_2-Prototyps, siehe
     tickets/130_2/IMPLEMENTATION_PLAN.md, "Presentational-Komponenten". -->
<template>
  <span class="badge cp-type-badge" :class="typeClass">
    <font-awesome-icon :icon="typeIcon" class="me-1" />
    {{ typeLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { CHECKPOINT_TYPE } from '@/composables/useCheckpointsMock'

const props = defineProps({
  type: {
    type: Number,
    required: true
  }
})

const typeLabel = computed(() => {
  switch (props.type) {
    case CHECKPOINT_TYPE.BUS: return 'Bus'
    case CHECKPOINT_TYPE.GROUP: return 'Group'
    case CHECKPOINT_TYPE.LAZY: return 'Lazy'
    default: return 'Unbekannt'
  }
})

const typeIcon = computed(() => {
  switch (props.type) {
    case CHECKPOINT_TYPE.BUS: return ['fas', 'bus']
    case CHECKPOINT_TYPE.GROUP: return ['fas', 'users']
    case CHECKPOINT_TYPE.LAZY: return ['fas', 'clipboard-check']
    default: return ['fas', 'info-circle']
  }
})

const typeClass = computed(() => {
  switch (props.type) {
    case CHECKPOINT_TYPE.BUS: return 'bg-primary'
    case CHECKPOINT_TYPE.GROUP: return 'bg-info text-dark'
    case CHECKPOINT_TYPE.LAZY: return 'bg-secondary'
    default: return 'bg-secondary'
  }
})
</script>

<style scoped>
.cp-type-badge {
  font-size: 1rem;
  font-weight: 700;
  padding: 0.5rem 0.8rem;
}
</style>
