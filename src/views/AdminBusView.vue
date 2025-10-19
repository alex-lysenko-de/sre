<template>
  <div class="admin-bus-view">
    <!-- Alert Container -->
    <div id="alertContainer" class="mb-3"></div>

    <!-- Total Summary Card -->
    <div
        class="total-summary card mb-4"
        :class="{ 'complete': allBusesHaveData }"
    >
      <div class="card-body">
        <h3 class="mb-3">Gesamt</h3>
        <div class="row text-center">
          <div class="col-6">
            <div class="total-count display-4 fw-bold text-primary">
              {{ totalChildren }}
            </div>
            <h4 class="mt-2">Kinder</h4>
          </div>
          <div class="col-6">
            <div class="total-count display-4 fw-bold text-success">
              {{ totalBetreuer }}
            </div>
            <h4 class="mt-2">Betreuer</h4>
          </div>
        </div>

        <!-- Header Info -->
        <div v-show="showHeaderInfo" class="mt-4 text-center">
          <h5>
            <i class="fas fa-bus me-2"></i>Bus-Übersicht
          </h5>
          <p class="mb-0 text-muted">
            {{ formattedCurrentDate }} - {{ activeBusesCount }} von {{ totalBusCount }} Bussen aktiv
          </p>
        </div>

        <!-- All Buses Complete Message -->
        <div v-if="allBusesHaveData" class="mt-4 text-center">
          <h5 class="text-success">
            <i class="fas fa-check-circle me-2"></i>Alle Busse erfasst!
          </h5>
          <p class="mb-0">Bereit für die Abfahrt</p>
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <button
        class="btn btn-primary w-100 mb-3"
        @click="loadBusData"
        :disabled="loading"
    >
      <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
      <i v-else class="fas fa-sync-alt me-2"></i>
      {{ loading ? 'Laden...' : 'Aktualisieren' }}
    </button>

    <!-- Bus Overview Card -->
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">
          <i class="fas fa-bus me-2"></i>Alle Busse
          <span class="badge bg-secondary ms-2">
            {{ activeBusesCount }} aktive Busse
          </span>
        </h5>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Bus-Daten für heute...</p>
        </div>

        <!-- No Data State -->
        <div v-else-if="!hasBusData" class="text-center py-5">
          <i class="fas fa-info-circle fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">Keine Bus-Daten für heute verfügbar</h5>
          <p class="text-muted">Noch kein Betreuer hat Bus-Daten heute übermittelt.</p>
        </div>

        <!-- Bus Table -->
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
            <tr>
              <th scope="col" style="width: 50px"></th>
              <th scope="col">Bus</th>
              <th scope="col">Kinder</th>
              <th scope="col">Betreuer</th>
              <th scope="col">Verantwortlicher</th>
              <th scope="col">Letzte Aktualisierung</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="busNumber in totalBusRange"
                :key="busNumber"
                :class="{ 'table-secondary': !getBusData(busNumber).hasData }"
            >
              <td>
                  <span
                      class="status-indicator"
                      :class="getBusData(busNumber).hasData ? 'bg-success' : 'bg-secondary'"
                      :title="getBusData(busNumber).hasData ? 'Daten verfügbar' : 'Keine Daten'"
                  ></span>
              </td>
              <td>
                  <span class="fw-bold">
                    <i class="fas fa-bus me-2"></i>
                    Bus {{ busNumber }}
                  </span>
              </td>
              <td>
                  <span v-if="getBusData(busNumber).hasData" class="badge bg-primary">
                    {{ getBusData(busNumber).kinder_count }}
                  </span>
                <span v-else class="text-muted">Nicht gesetzt</span>
              </td>
              <td>
                  <span v-if="getBusData(busNumber).hasData" class="badge bg-success">
                    {{ getBusData(busNumber).betreuer_count }}
                  </span>
                <span v-else class="text-muted">Nicht gesetzt</span>
              </td>
              <td>
                  <span v-if="getBusData(busNumber).betreuer_name" class="text-dark">
                    {{ getBusData(busNumber).betreuer_name }}
                  </span>
                <span v-else class="text-muted">Unbekannt</span>
              </td>
              <td>
                  <span v-if="getBusData(busNumber).timestamp" class="text-muted">
                    {{ formatTimestamp(getBusData(busNumber).timestamp) }}
                  </span>
                <span v-else class="text-muted">-</span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Back Button -->
    <button class="btn btn-outline-secondary w-100 mt-3" @click="goBack">
      <i class="fas fa-arrow-left me-2"></i>
      Zurück
    </button>

    <!-- Last Update Time -->
    <div class="text-center mt-3 text-muted">
      <i class="fas fa-sync-alt me-1"></i>
      Letzte Aktualisierung: {{ lastUpdateTime || '-' }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'AdminBusView',

  setup() {
    // ============================================================================
    // STATE
    // ============================================================================
    const loading = ref(true)
    const showHeaderInfo = ref(true)
    const lastUpdateTime = ref(null)
    const currentDate = ref(getCurrentDateString())

    // Total bus count (from config)
    const totalBusCount = ref(3)

    // Bus data structure
    const busesData = ref({
      '1': {
        kinder_count: 8,
        betreuer_count: 2,
        betreuer_name: 'Schmidt, M.',
        timestamp: new Date().toISOString()
      },
      '2': {
        kinder_count: 12,
        betreuer_count: 3,
        betreuer_name: 'Müller, A.',
        timestamp: new Date().toISOString()
      },
      '3': {
        kinder_count: 10,
        betreuer_count: 2,
        betreuer_name: 'Weber, K.',
        timestamp: new Date().toISOString()
      }
    })

    // ============================================================================
    // COMPUTED PROPERTIES
    // ============================================================================
    const formattedCurrentDate = computed(() => {
      return formatDateForDisplay(currentDate.value)
    })

    const totalChildren = computed(() => {
      return Object.values(busesData.value).reduce((sum, bus) => {
        return sum + (bus.kinder_count || 0)
      }, 0)
    })

    const totalBetreuer = computed(() => {
      return Object.values(busesData.value).reduce((sum, bus) => {
        return sum + (bus.betreuer_count || 0)
      }, 0)
    })

    const activeBusesCount = computed(() => {
      return Object.keys(busesData.value).length
    })

    const hasBusData = computed(() => {
      return Object.keys(busesData.value).length > 0
    })

    const totalBusRange = computed(() => {
      return Array.from({ length: totalBusCount.value }, (_, i) => i + 1)
    })

    const allBusesHaveData = computed(() => {
      if (totalBusCount.value === 0) return false

      for (let i = 1; i <= totalBusCount.value; i++) {
        const busData = getBusData(i)
        if (!busData.hasData) return false
      }
      return true
    })

    // ============================================================================
    // METHODS
    // ============================================================================
    function getCurrentDateString() {
      return new Date().toISOString().split('T')[0]
    }

    function formatDateForDisplay(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    function getCurrentTimeForDisplay() {
      return new Date().toLocaleTimeString('de-DE')
    }

    function getBusData(busNumber) {
      const bus = busesData.value[busNumber.toString()]

      if (!bus || bus.kinder_count === null || bus.kinder_count === undefined) {
        return {
          hasData: false,
          kinder_count: null,
          betreuer_count: null,
          betreuer_name: null,
          timestamp: null
        }
      }

      return {
        hasData: true,
        ...bus
      }
    }

    function formatTimestamp(timestamp) {
      if (!timestamp) return '-'

      try {
        const date = new Date(timestamp)
        return date.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch (error) {
        return '-'
      }
    }

    async function loadBusData() {
      loading.value = true

      try {
        // Simulate API call with delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        // In real implementation, data would come from API/Supabase
        // For now, just update the timestamp
        Object.keys(busesData.value).forEach(busNumber => {
          busesData.value[busNumber].timestamp = new Date().toISOString()
        })

        lastUpdateTime.value = getCurrentTimeForDisplay()
      } catch (error) {
        console.error('Fehler beim Laden der Busdaten:', error)
      } finally {
        loading.value = false
      }
    }

    function goBack() {
      // In real implementation, use Vue Router
      // this.$router.push({ name: 'AdminDashboard' })
      window.history.back()
    }

    // ============================================================================
    // LIFECYCLE
    // ============================================================================
    onMounted(async () => {
      await loadBusData()

      // Hide header info after 3 seconds
      setTimeout(() => {
        showHeaderInfo.value = false
      }, 3000)
    })

    return {
      // State
      loading,
      showHeaderInfo,
      lastUpdateTime,
      currentDate,
      totalBusCount,
      busesData,

      // Computed
      formattedCurrentDate,
      totalChildren,
      totalBetreuer,
      activeBusesCount,
      hasBusData,
      totalBusRange,
      allBusesHaveData,

      // Methods
      getBusData,
      formatTimestamp,
      loadBusData,
      goBack
    }
  }
}
</script>

<style scoped>
.admin-bus-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Total Summary Card */
.total-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.total-summary.complete {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.total-summary .card-body {
  padding: 2rem;
}

.total-summary h3,
.total-summary h4,
.total-summary h5,
.total-summary p {
  color: white;
}

.total-count {
  font-size: 3rem;
  font-weight: bold;
}

/* Status Indicator */
.status-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

/* Table Styling */
.table {
  margin-bottom: 0;
}

.table th {
  background-color: #f8f9fa;
  font-weight: 600;
  border-bottom: 2px solid #dee2e6;
}

.table tbody tr {
  transition: background-color 0.2s ease;
}

.table tbody tr:hover {
  background-color: #f8f9fa;
}

/* Responsive Design */
@media (max-width: 768px) {
  .admin-bus-view {
    padding: 10px;
  }

  .total-count {
    font-size: 2rem;
  }

  .table-responsive {
    font-size: 0.875rem;
  }

  .card-body {
    padding: 1rem;
  }
}

/* Animation for header info */
@keyframes fadeOut {
  from {
    opacity: 1;
    max-height: 100px;
  }
  to {
    opacity: 0;
    max-height: 0;
  }
}
</style>