<!-- src/views/EntityListPrototypeView.vue -->
<!-- Ticket 130_2 - UX-Feedback Runde 4 ("Entity-zentrierte" Ueberarbeitung).
     Neue universelle Liste: "Jede Kind-/Betreuer-Liste verwendet denselben
     Bildschirm, egal ob sie ueber Bus, Gruppe, Checkpoint-Aggregat,
     Anwesend- oder Fehlend-Liste geoeffnet wurde." Vorher hatte jede
     Detail-View (Bus/Group/Lazy) ihre eigene, leicht unterschiedliche
     Auflistung mit eigenem Markup. Jetzt: eine Route
     (/admin/checkpoints-prototype/list), gesteuert per Query-Parameter
     (kind/scope/scopeId/checkpointId/filter), damit die URL beim Neuladen
     denselben Zustand reproduziert (keine rohen Anzeigetexte in der URL).

     EL1: Titel + Zurueck. EL2: Kontextzeile (von welcher Entitaet geoeffnet -
     "Bus 3 / BUS Checkpoint #5"). EL3: EntityListCard.vue (derselbe
     Baustein wie in GroupEntityPrototypeView.vue). -->
<template>
  <div class="cp-list-detail-view">
    <DebugTag variant="page" label="Page 5" />

    <div class="cp-header">
      <DebugTag label="el1" />
      <div class="cp-header-top">
        <button class="cp-back-btn me-2" @click="goBack">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
        </button>
        <span class="cp-header-title">{{ pageTitle }}</span>
      </div>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status"></div>
    </div>

    <template v-else>
      <div class="cp-context-line">
        <DebugTag label="el2" />
        {{ contextLine }}
      </div>

      <div class="card">
        <div class="card-body">
          <DebugTag label="el3" />
          <EntityListCard
              :items="items"
              :kind="kind"
              :emphasize="isEmphasized"
              empty-text="Keine Einträge."
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CHECKPOINT_TYPE,
  fetchCheckpointDetail,
  getBusChildrenBreakdown,
  getGroupChildrenBreakdown,
  getCheckpointBetreuerList,
  getDayBaselineCheckpoint
} from '@/composables/useCheckpointsMock'
import { fetchLazyCheckpointProgress } from '@/composables/useLazyCheckpointProgressMock'
import EntityListCard from '@/components/checkpoints-prototype/EntityListCard.vue'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const checkpoint = ref(null)
const items = ref([])

const kind = computed(() => route.query.kind === 'betreuer' ? 'betreuer' : 'child')
const scope = computed(() => route.query.scope || 'checkpoint')
const scopeId = computed(() => route.query.scopeId != null ? Number(route.query.scopeId) : null)
const filter = computed(() => route.query.filter || 'all')

const isEmphasized = computed(() => ['absent', 'missing', 'notYet'].includes(filter.value))

const routeSegmentForType = {
  [CHECKPOINT_TYPE.BUS]: 'bus',
  [CHECKPOINT_TYPE.GROUP]: 'group',
  [CHECKPOINT_TYPE.LAZY]: 'lazy'
}

const typeLabel = {
  [CHECKPOINT_TYPE.BUS]: 'BUS',
  [CHECKPOINT_TYPE.GROUP]: 'GROUP',
  [CHECKPOINT_TYPE.LAZY]: 'LAZY'
}

const pageTitle = computed(() => {
  const kindLabel = kind.value === 'betreuer' ? 'Betreuer' : 'Kinder'
  const filterLabel = {
    present: 'Anwesende',
    absent: 'Fehlende',
    missing: 'Fehlende',
    extra: 'Zusätzliche',
    checkedIn: 'Gemeldete',
    notYet: 'Noch nicht gemeldete',
    all: null
  }[filter.value]

  if (!filterLabel) return kindLabel
  return kind.value === 'child' ? `${filterLabel} Kinder` : `${filterLabel} Betreuer`
})

const contextLine = computed(() => {
  if (!checkpoint.value) return ''
  const parts = []
  if (scope.value === 'bus' && scopeId.value != null) parts.push(`Bus ${scopeId.value}`)
  if (scope.value === 'group' && scopeId.value != null) parts.push(`Gruppe ${scopeId.value}`)
  parts.push(`${typeLabel[checkpoint.value.type]} Checkpoint #${checkpoint.value.seq}`)
  return parts.join(' / ')
})

function diffChildrenByBaseline(bus, baselineBus, mode) {
  if (!bus || !baselineBus) return []
  const currentIds = new Set(bus.children.map(c => c.id))
  const baselineIds = new Set(baselineBus.children.map(c => c.id))
  if (mode === 'missing') return baselineBus.children.filter(c => !currentIds.has(c.id))
  return bus.children.filter(c => !baselineIds.has(c.id))
}

async function loadItems(cp) {
  if (kind.value === 'betreuer') {
    if (scope.value === 'bus') {
      const bus = cp.buses.find(b => b.busNumber === scopeId.value)
      return bus ? bus.betreuer : []
    }
    if (scope.value === 'group') {
      const group = cp.groups.find(g => g.groupId === scopeId.value)
      return group ? group.betreuer : []
    }
    return getCheckpointBetreuerList(cp)
  }

  // kind === 'child'
  if (scope.value === 'bus') {
    const bus = cp.buses.find(b => b.busNumber === scopeId.value)
    if (!bus) return []
    if (filter.value === 'missing' || filter.value === 'extra') {
      const baselineCp = getDayBaselineCheckpoint(cp.day)
      const baselineBus = baselineCp?.buses?.find(b => b.busNumber === scopeId.value)
      return diffChildrenByBaseline(bus, baselineBus, filter.value)
    }
    return bus.children
  }

  if (scope.value === 'group') {
    const breakdown = getGroupChildrenBreakdown(cp)
    if (filter.value === 'absent') return breakdown.absent.filter(c => c.groupId === scopeId.value)
    return breakdown.present.filter(c => c.groupId === scopeId.value)
  }

  if (scope.value === 'lazy') {
    const progress = await fetchLazyCheckpointProgress(cp.id)
    return filter.value === 'notYet' ? progress.notYet : progress.checkedIn
  }

  // scope === 'checkpoint' - Aggregat ueber die ganze Checkpoint
  const breakdown = cp.type === CHECKPOINT_TYPE.GROUP ? getGroupChildrenBreakdown(cp) : getBusChildrenBreakdown(cp)
  return filter.value === 'absent' ? breakdown.absent : breakdown.present
}

async function load() {
  loading.value = true
  const checkpointId = Number(route.query.checkpointId)
  checkpoint.value = await fetchCheckpointDetail(checkpointId)
  items.value = checkpoint.value ? await loadItems(checkpoint.value) : []
  loading.value = false
}

function goBack() {
  if (checkpoint.value) {
    const segment = routeSegmentForType[checkpoint.value.type] || 'bus'
    router.push(`/admin/checkpoints-prototype/${segment}/${checkpoint.value.id}`)
    return
  }
  router.push('/admin/checkpoints-prototype')
}

onMounted(load)
</script>

<style scoped>
.cp-list-detail-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
}

.cp-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.cp-header-title {
  font-size: 1.4rem;
  font-weight: 700;
  flex: 1;
}

.cp-back-btn {
  border: none;
  border-radius: 8px;
  background-color: #e9ecef;
  color: #495057;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}

.cp-context-line {
  color: #6c757d;
  font-weight: 600;
  margin-bottom: 10px;
}
</style>
