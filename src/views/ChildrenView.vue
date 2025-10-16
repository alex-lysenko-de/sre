<template>
  <div class="container py-4">
    <!-- Summary -->
    <div class="card mb-4 shadow-sm">
      <div class="card-body text-center">
        <h4>Kinderübersicht</h4>
        <div class="row mt-3">
          <div class="col-md-6">
            <h5>Am Morgen</h5>
            <div class="display-6 text-primary">{{ totalMorning }}</div>
          </div>
          <div class="col-md-6">
            <h5>Aktuell</h5>
            <div class="display-6 text-success">{{ totalCurrent }}</div>
          </div>
        </div>
        <div v-if="missingGroups.length" class="alert alert-warning mt-3">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
          Achtung! {{ totalMissing }} Kind(er) fehlen in {{ missingGroups.length }} Gruppe(n)
        </div>
      </div>
    </div>

    <!-- Groups Table -->
    <div class="card shadow-sm">
      <div class="card-body">
        <h5>
          <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
          Gruppenübersicht
          <span class="badge bg-secondary ms-2">{{ groups.length }} Gruppen</span>
        </h5>

        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead class="table-light">
            <tr>
              <th>Status</th>
              <th>Gruppe</th>
              <th>Morgen</th>
              <th>Aktuell</th>
              <th>Betreuer</th>
              <th>Differenz</th>
              <th>Aktualisiert</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="group in groups" :key="group.id">
              <td>
                <span :class="getStatusClass(group)" class="status-dot me-1"></span>
              </td>
              <td>
                <router-link
                    :to="`/group-edit/${group.id}`"
                    class="text-decoration-none fw-bold"
                >
                  Gruppe {{ group.id }}
                </router-link>
              </td>
              <td>{{ group.morning ?? '-' }}</td>
              <td>{{ group.current ?? '-' }}</td>
              <td>{{ group.betreuer?.join(', ') || '—' }}</td>
              <td v-html="formatDifference(group)"></td>
              <td>{{ group.timestamp || '-' }}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 🧠 English comments
// This version loads the total number of groups from Supabase config using Pinia store
// If config not loaded yet, defaults to 15 groups.
// Each group displays a colored status dot:
//  🟢 green if morning == current
//  🔴 red if current < morning
// Group number links to /group-edit/{id}

import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '@/stores/config'

export default {
  name: 'AdminGroupView',
  setup() {
    const configStore = useConfigStore()

    const groups = ref([])

    const totalMorning = computed(() =>
        groups.value.reduce((sum, g) => sum + (g.morning || 0), 0)
    )
    const totalCurrent = computed(() =>
        groups.value.reduce((sum, g) => sum + (g.current || 0), 0)
    )

    const missingGroups = computed(() =>
        groups.value.filter((g) => g.morning > (g.current || 0))
    )
    const totalMissing = computed(() =>
        missingGroups.value.reduce((sum, g) => sum + (g.morning - (g.current || 0)), 0)
    )

    // Determine status color class
    const getStatusClass = (group) => {
      if (group.current === group.morning) return 'bg-transparent'
      if (group.current < group.morning) return 'bg-warning'
      return 'bg-secondary'
    }

    const formatDifference = (group) => {
      if (group.morning == null || group.current == null) return '-'
      const diff = group.morning - group.current
      if (diff === 0)
        return '<span class="text-success">Komplett</span>'
      if (diff > 0)
        return `<span class="text-danger">-${diff}</span>`
      return `<span class="text-info">+${Math.abs(diff)}</span>`
    }

    // Generate placeholder groups
    const initGroups = (count) => {
      const betreuerNames = ['Anna', 'Max', 'Lisa', 'Paul', 'Sophie', 'Jonas']
      groups.value = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        morning: 10,
        current: Math.floor(8 + Math.random() * 3), // 8–10 kids
        betreuer: [
          betreuerNames[Math.floor(Math.random() * betreuerNames.length)],
          betreuerNames[Math.floor(Math.random() * betreuerNames.length)],
        ],
        timestamp: new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }))
    }

    onMounted(async () => {
      const loaded = await configStore.loadConfig()
      const total = parseInt(loaded?.total_groups || 15)
      initGroups(total)
    })

    return {
      groups,
      totalMorning,
      totalCurrent,
      missingGroups,
      totalMissing,
      getStatusClass,
      formatDifference,
    }
  },
}
</script>

<style scoped>
.table th,
.table td {
  text-align: center;
}

.status-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.card {
  border-radius: 1rem;
}

.alert {
  border-radius: 1rem;
}

.table-hover tbody tr:hover {
  background-color: rgba(0, 123, 255, 0.05);
}
</style>