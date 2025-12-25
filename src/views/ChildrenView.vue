<template>
  <div class="container py-4">
    <!-- Loading State -->
    <div v-if="loading && !groups.length" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Lädt...</span>
      </div>
      <p class="mt-3 text-muted">Lade Gruppendaten...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <font-awesome-icon :icon="['fas', 'exclamation-circle']" class="me-2" />
      <strong>Fehler beim Laden der Daten:</strong> {{ error }}
      <button type="button" class="btn-close" @click="error = null" aria-label="Close"></button>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !error && !groups.length" class="text-center py-5">
      <font-awesome-icon :icon="['fas', 'users']" class="text-muted" style="font-size: 4rem;" />
      <h4 class="mt-3 text-muted">Keine Gruppendaten verfügbar</h4>
      <p class="text-muted">Es wurden noch keine Gruppen für heute erfasst.</p>
      <button class="btn btn-primary mt-3" @click="loadGroupsData">
        <font-awesome-icon :icon="['fas', 'sync']" class="me-2" />
        Erneut versuchen
      </button>
    </div>

    <!-- Main Content (only show if we have groups) -->
    <template v-if="groups.length > 0">
      <!-- Header with Refresh Button -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 class="mb-0">Kinderübersicht</h3>
          <small class="text-muted" v-if="lastUpdateTime">
            Zuletzt aktualisiert: {{ lastUpdateTime }}
          </small>
        </div>
        <button
            class="btn btn-outline-primary"
            @click="loadGroupsData"
            :disabled="loading"
        >
          <font-awesome-icon
              :icon="['fas', 'sync']"
              :spin="loading"
              class="me-2"
          />
          Aktualisieren
        </button>
      </div>

      <!-- Summary -->
      <div class="card mb-4 shadow-sm">
        <div class="card-body text-center">
          <h4>Zusammenfassung</h4>
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
          <div v-if="missingGroups.length" class="alert alert-warning mt-3 mb-0">
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
                <th>Daten</th>
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
                <td>
                  <span v-if="group.betreuer && group.betreuer.length">
                    {{ group.betreuer.join(', ') }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td v-html="formatDifference(group)"></td>
                <td>
                  <span v-if="group.hasData" class="badge bg-success">Vorhanden</span>
                  <span v-else class="badge bg-secondary">Keine Daten</span>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
// 🧠 This version loads REAL data from Supabase instead of synthetic data
// Features:
// - Loads from groups_today and user_group_day tables
// - Shows loading spinner during data fetch
// - Displays error messages if loading fails
// - Refresh button to manually reload data
// - Realtime updates when database changes
// - Shows which groups have data vs empty groups

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConfigStore } from '@/stores/config'
import { fetchGroupsData, subscribeToGroupsChanges } from '@/composables/useGroups'

export default {
  name: 'AdminGroupView',
  setup() {
    const configStore = useConfigStore()

    // State
    const groups = ref([])
    const loading = ref(false)
    const error = ref(null)
    const lastUpdateTime = ref(null)
    const currentDate = ref(new Date().toISOString().split('T')[0])

    // Realtime subscription
    let realtimeSubscription = null
    let debounceTimeout = null

    // Computed properties
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

    // Determine status color class based on data availability and difference
    const getStatusClass = (group) => {
      if (!group.hasData) return 'bg-secondary'  // Gray for no data
      if (group.current === group.morning) return 'bg-success'  // Green for complete
      if (group.current < group.morning) return 'bg-danger'  // Red for missing children
      return 'bg-info'  // Blue for extra children
    }

    const formatDifference = (group) => {
      if (!group.hasData) return '<span class="text-muted">—</span>'
      if (group.morning == null || group.current == null) return '-'

      const diff = group.morning - group.current
      if (diff === 0)
        return '<span class="text-success fw-bold">Komplett</span>'
      if (diff > 0)
        return `<span class="text-danger fw-bold">-${diff}</span>`
      return `<span class="text-info fw-bold">+${Math.abs(diff)}</span>`
    }

    // Load groups data from database
    const loadGroupsData = async () => {
      loading.value = true
      error.value = null

      try {
        const data = await fetchGroupsData(currentDate.value)
        groups.value = data

        // Update last update time
        lastUpdateTime.value = new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      } catch (err) {
        console.error('Error loading groups:', err)
        error.value = err.message || 'Unbekannter Fehler beim Laden der Daten'
      } finally {
        loading.value = false
      }
    }

    // Debounced reload function for realtime updates
    const debouncedReload = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      debounceTimeout = setTimeout(() => {
        console.log('Realtime: Reloading groups data...')
        loadGroupsData()
      }, 1000)  // Wait 1 second after last change
    }

    // Setup realtime subscription
    const setupRealtimeSubscription = () => {
      try {
        realtimeSubscription = subscribeToGroupsChanges((payload) => {
          console.log('Realtime update received:', payload)
          debouncedReload()
        })
        console.log('Realtime subscription active')
      } catch (err) {
        console.error('Error setting up realtime subscription:', err)
      }
    }

    // Clear realtime subscription
    const clearRealtimeSubscription = () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe()
        realtimeSubscription = null
        console.log('Realtime subscription cleared')
      }
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
        debounceTimeout = null
      }
    }

    onMounted(async () => {
      // Load config to get total groups
      await configStore.loadConfig()

      // Load initial data
      await loadGroupsData()

      // Setup realtime updates
      setupRealtimeSubscription()
    })

    onUnmounted(() => {
      // Clean up realtime subscription
      clearRealtimeSubscription()
    })

    return {
      groups,
      loading,
      error,
      lastUpdateTime,
      totalMorning,
      totalCurrent,
      missingGroups,
      totalMissing,
      getStatusClass,
      formatDifference,
      loadGroupsData,
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
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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

.spinner-border {
  width: 3rem;
  height: 3rem;
}

/* Improve button disabled state */
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Smooth transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>