<!-- src/components/checkpoints/EntityListCard.vue -->
<!-- Universeller Listen-Baustein - dieselbe Komponente fuer jede Kind-/
     Betreuer-Liste, egal ob ueber Bus, Gruppe, Checkpoint-Aggregat oder
     Lazy geoeffnet. Ported unchanged from the 130_2 prototype - purely
     presentational, no mock dependency. -->
<template>
  <div class="cp-entity-list-card" :class="emphasize ? 'cp-entity-list-card-emphasize' : ''">
    <div v-if="title || showCopy" class="cp-entity-list-header">
      <span v-if="title" class="cp-entity-list-title">{{ title }} ({{ items.length }})</span>
      <button v-if="showCopy && items.length" class="btn btn-sm cp-copy-btn" @click="copy">
        {{ copied ? 'Kopiert!' : 'Kopieren' }}
      </button>
    </div>
    <div class="cp-entity-list-body">
      <div v-if="!items.length" class="text-muted">{{ emptyText }}</div>
      <template v-else-if="kind === 'child'">
        <ChildLink v-for="item in items" :key="item.id" :child="item" />
      </template>
      <template v-else>
        <BetreuerLink v-for="item in items" :key="item.id" :betreuer="item" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ChildLink from './ChildLink.vue'
import BetreuerLink from './BetreuerLink.vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  kind: {
    type: String,
    required: true // 'child' | 'betreuer'
  },
  title: {
    type: String,
    default: ''
  },
  emptyText: {
    type: String,
    default: 'Keine.'
  },
  showCopy: {
    type: Boolean,
    default: true
  },
  emphasize: {
    type: Boolean,
    default: false
  }
})

const copied = ref(false)

async function copy() {
  const lines = props.items.map(item =>
      props.kind === 'child' ? `- ${item.name} (G-${item.groupId})` : `- ${item.name}`
  )
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch (err) {
    console.error('Fehler beim Kopieren:', err)
  }
}
</script>

<style scoped>
.cp-entity-list-card-emphasize {
  background-color: #f8d7da;
  border-radius: 8px;
  padding: 8px;
}

.cp-entity-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  margin-bottom: 6px;
}

.cp-entity-list-card-emphasize .cp-entity-list-header {
  color: #842029;
}

.cp-entity-list-body {
  display: flex;
  flex-direction: column;
  max-height: 260px;
  overflow-y: auto;
}

.cp-copy-btn {
  border: none;
  border-radius: 6px;
  background-color: #6c757d;
  color: #fff;
  font-size: 0.85rem;
  padding: 4px 10px;
}
</style>
