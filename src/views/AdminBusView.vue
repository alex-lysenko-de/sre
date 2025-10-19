<template>
  <div class="admin-bus-view">
    <!-- Alert Container -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>
      {{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <div v-if="success" class="alert alert-success alert-dismissible fade show" role="alert">
      <i class="fas fa-check-circle me-2"></i>
      {{ success }}
      <button type="button" class="btn-close" @click="success = null"></button>
    </div>

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

    <!-- Action Buttons -->
    <div class="row mb-3 g-2">
      <div :class="dayStarted ? 'col-md-6' : 'col-md-4'">
        <button
            class="btn btn-primary w-100"
            @click="loadBusData"
            :disabled="loading"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="fas fa-sync-alt me-2"></i>
          {{ loading ? 'Laden...' : 'Aktualisieren' }}
        </button>
      </div>
      <div class="col-md-4" v-if="!dayStarted">
        <button
            class="btn btn-success w-100"
            @click="startDay"
            :disabled="loading || startingDay"
        >
          <span v-if="startingDay" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="fas fa-play me-2"></i>
          {{ startingDay ? 'Starte Tag...' : 'Tag starten' }}
        </button>
      </div>
      <div :class="dayStarted ? 'col-md-6' : 'col-md-4'">
        <button
            class="btn btn-warning w-100"
            @click="performSoftReset"
            :disabled="loading || resetting"
        >
          <span v-if="resetting" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="fas fa-redo me-2"></i>
          {{ resetting ? 'Resette...' : 'Soft Reset' }}
        </button>
      </div>
    </div>

    <!-- Reset History Panel -->
    <ResetHistoryPanel
        :date="currentDate"
        :auto-refresh="true"
        class="mb-3"
    />

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
        <div v-if="loading && !hasBusData" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Bus-Daten für heute...</p>
        </div>

        <!-- No Data State -->
        <div v-else-if="!hasBusData && !loading" class="text-center py-5">
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
              <th scope="col">Verantwortliche</th>
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
                <button
                    class="btn btn-link text-start p-0 fw-bold text-decoration-none"
                    @click="openBusDetail(busNumber)"
                >
                  <i class="fas fa-bus me-2"></i>
                  Bus {{ busNumber }}
                </button>
              </td>
              <td>
                  <span v-if="getBusData(busNumber).hasData" class="badge bg-primary">
                    {{ getBusData(busNumber).kinder_count }}
                  </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td>
                  <span v-if="getBusData(busNumber).hasData" class="badge bg-success">
                    {{ getBusData(busNumber).betreuer_count }}
                  </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td>
                <div v-if="getBusData(busNumber).betreuer_names.length > 0">
                    <span
                        v-for="(name, idx) in getBusData(busNumber).betreuer_names"
                        :key="idx"
                        class="badge bg-info text-dark me-1"
                    >
                      {{ name }}
                    </span>
                </div>
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
    <div class="text-center mt-3 text-muted d-flex justify-content-center align-items-center gap-3">
      <div>
        <i class="fas fa-sync-alt me-1"></i>
        Letzte Aktualisierung: {{ lastUpdateTime || '-' }}
      </div>
      <div class="realtime-status">
        <span
            class="status-dot"
            :class="{
            'status-connected': realtimeStatus === 'connected',
            'status-connecting': realtimeStatus === 'connecting',
            'status-disconnected': realtimeStatus === 'disconnected'
          }"
        ></span>
        <span class="status-text">
          {{ realtimeStatus === 'connected' ? 'Live' :
            realtimeStatus === 'connecting' ? 'Verbinde...' :
                'Offline' }}
        </span>
      </div>
    </div>

    <!-- Bus Detail Modal -->
    <BusDetailModal
        :show="showBusModal"
        :bus-number="selectedBusNumber"
        @close="closeBusModal"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useBusData } from '@/composables/useBusData'
import BusDetailModal from '@/components/BusDetailModal.vue'
import ResetHistoryPanel from '@/components/ResetHistoryPanel.vue'
import { useDays } from "@/composables/useDays.js"
import { supabase } from '@/supabase'

export default {
  name: 'AdminBusView',

  components: {
    BusDetailModal,
    ResetHistoryPanel
  },

  setup() {
    // ============================================================================
    // STORES & COMPOSABLES
    // ============================================================================
    const configStore = useConfigStore()
    const { fetchBusData } = useBusData()
    const { startNewDay, softReset, isDayStarted } = useDays()

    // ============================================================================
    // STATE
    // ============================================================================
    const loading = ref(false)
    const startingDay = ref(false)
    const resetting = ref(false)
    const showHeaderInfo = ref(true)
    const lastUpdateTime = ref(null)
    const currentDate = ref(getCurrentDateString())
    const error = ref(null)
    const success = ref(null)
    const realtimeStatus = ref('disconnected') // 'disconnected' | 'connecting' | 'connected'
    const dayStarted = ref(false) // Track if day has been started

    // Bus data structure: { busNumber: { kinder_count, betreuer_count, betreuer_names } }
    const busesData = ref({})

    // Modal state
    const showBusModal = ref(false)
    const selectedBusNumber = ref(null)

    // Realtime subscription channel
    let realtimeChannel = null
    let reloadDebounceTimer = null

    // ============================================================================
    // COMPUTED PROPERTIES
    // ============================================================================
    const totalBusCount = computed(() => {
      return configStore.totalBuses || 0
    })

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
      return Object.values(busesData.value).filter(bus =>
          bus.kinder_count > 0 || bus.betreuer_count > 0
      ).length
    })

    const hasBusData = computed(() => {
      return Object.keys(busesData.value).length > 0
    })

    const totalBusRange = computed(() => {
      const count = totalBusCount.value
      return count > 0 ? Array.from({ length: count }, (_, i) => i + 1) : []
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
      const bus = busesData.value[busNumber]

      if (!bus) {
        return {
          hasData: false,
          kinder_count: 0,
          betreuer_count: 0,
          betreuer_names: []
        }
      }

      return {
        hasData: bus.kinder_count > 0 || bus.betreuer_count > 0,
        ...bus
      }
    }

    async function loadBusData() {
      loading.value = true
      error.value = null

      try {
        const today = getCurrentDateString()
        const data = await fetchBusData(today)

        busesData.value = data
        lastUpdateTime.value = getCurrentTimeForDisplay()

        // Check if day has been started
        dayStarted.value = await isDayStarted(today)

        // Show success message only if manually triggered
        if (!reloadDebounceTimer) {
          success.value = 'Bus-Daten erfolgreich aktualisiert!'
          setTimeout(() => { success.value = null }, 3000)
        }
      } catch (err) {
        console.error('Fehler beim Laden der Busdaten:', err)
        error.value = 'Fehler beim Laden der Bus-Daten. Bitte versuchen Sie es erneut.'
      } finally {
        loading.value = false
      }
    }

    async function startDay() {
      if (!confirm('Möchten Sie wirklich einen neuen Tag starten? Dies setzt die aktuellen Anwesenheitsdaten zurück.')) {
        return
      }

      startingDay.value = true
      error.value = null

      try {
        const today = getCurrentDateString()
        await startNewDay(today)

        success.value = 'Tag erfolgreich gestartet! Die Anwesenheitsdaten wurden zurückgesetzt.'
        setTimeout(() => { success.value = null }, 5000)

        // Update dayStarted flag
        dayStarted.value = true

        // Reload data after starting day
        await loadBusData()
      } catch (err) {
        console.error('Fehler beim Starten des Tages:', err)
        error.value = 'Fehler beim Starten des Tages. Bitte versuchen Sie es erneut.'
      } finally {
        startingDay.value = false
      }
    }

    async function performSoftReset() {
      if (!confirm('Soft Reset durchführen? Dies setzt nur die aktuellen Anwesenheitszähler zurück.')) {
        return
      }

      resetting.value = true
      error.value = null

      try {
        const today = getCurrentDateString()
        await softReset(today)

        success.value = 'Soft Reset erfolgreich durchgeführt!'
        setTimeout(() => { success.value = null }, 3000)

        // Reload data
        await loadBusData()
      } catch (err) {
        console.error('Fehler beim Soft Reset:', err)
        error.value = 'Fehler beim Soft Reset. Bitte versuchen Sie es erneut.'
      } finally {
        resetting.value = false
      }
    }

    function goBack() {
      // Use Vue Router if available
      if (window.history.length > 1) {
        window.history.back()
      } else {
        // Fallback to home or dashboard
        window.location.href = '/'
      }
    }

    function openBusDetail(busNumber) {
      selectedBusNumber.value = busNumber
      showBusModal.value = true
    }

    function closeBusModal() {
      showBusModal.value = false
      selectedBusNumber.value = null
    }

    /**
     * Debounced reload function to prevent multiple rapid reloads
     */
    function debouncedReload() {
      if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer)
      }

      reloadDebounceTimer = setTimeout(() => {
        console.log('🔄 Reloading bus data after changes...')
        loadBusData()
      }, 1000) // Wait 1 second after last change
    }

    /**
     * Setup Realtime subscription for bus data changes
     */
    function setupRealtimeSubscription() {
      realtimeStatus.value = 'connecting'

      // Subscribe to changes in children_today and user_group_day tables
      realtimeChannel = supabase
          .channel('bus-data-changes')
          .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'children_today'
              },
              (payload) => {
                console.log('🔄 Children data changed:', payload)
                debouncedReload()
              }
          )
          .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'user_group_day',
                filter: `day=eq.${currentDate.value}`
              },
              (payload) => {
                console.log('🔄 Betreuer data changed:', payload)
                debouncedReload()
              }
          )
          .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'reset_events',
                filter: `day=eq.${currentDate.value}`
              },
              (payload) => {
                console.log('🔄 Reset event detected:', payload)
                debouncedReload()
              }
          )
          .subscribe((status) => {
            console.log('📡 Realtime subscription status:', status)
            if (status === 'SUBSCRIBED') {
              realtimeStatus.value = 'connected'
              console.log('✅ Successfully subscribed to bus data updates')
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              realtimeStatus.value = 'disconnected'
              console.warn('⚠️ Realtime connection lost')
            }
          })
    }

    /**
     * Clear Realtime subscription
     */
    function clearRealtimeSubscription() {
      if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer)
        reloadDebounceTimer = null
      }

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
        realtimeChannel = null
        realtimeStatus.value = 'disconnected'
        console.log('🔌 Realtime subscription removed')
      }
    }

    // ============================================================================
    // LIFECYCLE
    // ============================================================================
    onMounted(async () => {
      // Load config if not already loaded
      if (!configStore.isConfigLoaded()) {
        await configStore.loadConfig()
      }

      // Initial data load
      await loadBusData()

      // Hide header info after 3 seconds
      setTimeout(() => {
        showHeaderInfo.value = false
      }, 3000)

      // Setup Realtime subscription
      setupRealtimeSubscription()
    })

    onUnmounted(() => {
      clearRealtimeSubscription()
    })

    return {
      // State
      loading,
      startingDay,
      resetting,
      showHeaderInfo,
      lastUpdateTime,
      currentDate,
      error,
      success,
      busesData,
      showBusModal,
      selectedBusNumber,
      realtimeStatus,
      dayStarted,

      // Computed
      totalBusCount,
      formattedCurrentDate,
      totalChildren,
      totalBetreuer,
      activeBusesCount,
      hasBusData,
      totalBusRange,
      allBusesHaveData,

      // Methods
      getBusData,
      loadBusData,
      startDay,
      performSoftReset,
      openBusDetail,
      closeBusModal,
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
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 8px 12px rgba(17, 153, 142, 0.3);
  }
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
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
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

.table tbody tr.table-secondary {
  opacity: 0.6;
}

/* Badge Styling */
.badge {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

/* Alert Animations */
.alert {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Button Styling */
.btn {
  transition: all 0.2s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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

  .total-summary .card-body {
    padding: 1.5rem;
  }
}

/* Fade transition for header info */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Realtime Status Indicator */
.realtime-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  transition: all 0.3s ease;
}

.status-dot.status-connected {
  background-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  animation: pulse-green 2s infinite;
}

.status-dot.status-connecting {
  background-color: #f59e0b;
  animation: pulse-yellow 1s infinite;
}

.status-dot.status-disconnected {
  background-color: #6b7280;
}

@keyframes pulse-green {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }
}

@keyframes pulse-yellow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-weight: 500;
  color: #6b7280;
}
</style>