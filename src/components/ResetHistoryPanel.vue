<template>
  <div class="reset-history-panel">
    <!-- Header mit Toggle -->
    <div class="panel-header" @click="togglePanel">
      <h6 class="mb-0">
        <i class="fas fa-history me-2"></i>
        Reset-Historie ({{ resetEvents.length }})
      </h6>
      <i
          class="fas"
          :class="isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'"
      ></i>
    </div>

    <!-- Erweiterbare Liste -->
    <transition name="slide">
      <div v-if="isExpanded" class="panel-body">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-3">
          <div class="spinner-border spinner-border-sm"></div>
          <p class="text-muted small mb-0 mt-2">Lade Historie...</p>
        </div>

        <!-- Keine Events -->
        <div v-else-if="resetEvents.length === 0" class="text-center py-3">
          <i class="fas fa-info-circle text-muted mb-2"></i>
          <p class="text-muted small mb-0">Keine Reset-Ereignisse für heute</p>
        </div>

        <!-- Event Liste -->
        <div v-else class="event-list">
          <div
              v-for="event in resetEvents"
              :key="event.id"
              class="event-item"
              :class="`event-type-${event.event_type}`"
          >
            <div class="event-icon">
              <i :class="getEventIcon(event.event_type)"></i>
            </div>
            <div class="event-content">
              <div class="event-title">{{ getEventTypeName(event.event_type) }}</div>
              <div class="event-meta">
                <span class="event-time">
                  <i class="fas fa-clock me-1"></i>
                  {{ formatTime(event.created_at) }}
                </span>
                <span class="event-user">
                  <i class="fas fa-user me-1"></i>
                  {{ event.users.display_name }}
                </span>
              </div>
            </div>
            <div class="event-badge">
              <span
                  class="badge"
                  :class="getEventBadgeClass(event.event_type)"
              >
                {{ getEventBadgeText(event.event_type) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Refresh Button -->
        <button
            class="btn btn-sm btn-outline-secondary w-100 mt-2"
            @click.stop="loadHistory"
            :disabled="loading"
        >
          <i class="fas fa-sync-alt me-2"></i>
          Aktualisieren
        </button>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useBusData } from '@/composables/useBusData'

export default {
  name: 'ResetHistoryPanel',

  props: {
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    autoRefresh: {
      type: Boolean,
      default: false
    }
  },

  setup(props) {
    const { getResetHistory } = useBusData()

    const loading = ref(false)
    const isExpanded = ref(false)
    const resetEvents = ref([])
    let refreshInterval = null

    // ============================================================================
    // METHODS
    // ============================================================================

    async function loadHistory() {
      loading.value = true

      try {
        const events = await getResetHistory(props.date)
        resetEvents.value = events
      } catch (error) {
        console.error('Fehler beim Laden der Reset-Historie:', error)
      } finally {
        loading.value = false
      }
    }

    function togglePanel() {
      isExpanded.value = !isExpanded.value

      // Beim ersten Öffnen Daten laden
      if (isExpanded.value && resetEvents.value.length === 0) {
        loadHistory()
      }
    }

    function getEventTypeName(eventType) {
      const names = {
        0: 'Total Reset (Tag geschlossen)',
        1: 'Normal Reset (Tag gestartet)',
        2: 'Soft Reset (Zwischencheck)'
      }
      return names[eventType] || 'Unbekannter Reset'
    }

    function getEventIcon(eventType) {
      const icons = {
        0: 'fas fa-power-off text-danger',
        1: 'fas fa-play-circle text-success',
        2: 'fas fa-sync text-info'
      }
      return icons[eventType] || 'fas fa-question-circle'
    }

    function getEventBadgeClass(eventType) {
      const classes = {
        0: 'bg-danger',
        1: 'bg-success',
        2: 'bg-info'
      }
      return classes[eventType] || 'bg-secondary'
    }

    function getEventBadgeText(eventType) {
      const texts = {
        0: 'Total',
        1: 'Normal',
        2: 'Soft'
      }
      return texts[eventType] || 'Unknown'
    }

    function formatTime(timestamp) {
      if (!timestamp) return '-'

      try {
        const date = new Date(timestamp)
        return date.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      } catch (error) {
        return '-'
      }
    }

    function setupAutoRefresh() {
      if (props.autoRefresh && !refreshInterval) {
        refreshInterval = setInterval(() => {
          if (isExpanded.value) {
            loadHistory()
          }
        }, 30000) // Alle 30 Sekunden
      }
    }

    function clearAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
    }

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    onMounted(() => {
      setupAutoRefresh()
    })

    // Watch for date changes
    watch(() => props.date, () => {
      if (isExpanded.value) {
        loadHistory()
      }
    })

    // Cleanup
    watch(() => props.autoRefresh, (newVal) => {
      if (newVal) {
        setupAutoRefresh()
      } else {
        clearAutoRefresh()
      }
    })

    return {
      loading,
      isExpanded,
      resetEvents,
      togglePanel,
      loadHistory,
      getEventTypeName,
      getEventIcon,
      getEventBadgeClass,
      getEventBadgeText,
      formatTime
    }
  }
}
</script>

<style scoped>
.reset-history-panel {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  margin-bottom: 1rem;
}

.panel-header {
  padding: 1rem;
  background: #f8f9fa;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  transition: background-color 0.2s ease;
}

.panel-header:hover {
  background: #e9ecef;
}

.panel-header h6 {
  font-weight: 600;
  color: #495057;
}

.panel-body {
  padding: 1rem;
  border-top: 1px solid #dee2e6;
}

/* Event List */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  background: #f8f9fa;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.event-item:hover {
  background: #e9ecef;
  transform: translateX(2px);
}

.event-item.event-type-0 {
  border-left-color: #dc3545;
}

.event-item.event-type-1 {
  border-left-color: #28a745;
}

.event-item.event-type-2 {
  border-left-color: #17a2b8;
}

.event-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.event-content {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #212529;
  margin-bottom: 0.25rem;
}

.event-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #6c757d;
}

.event-time,
.event-user {
  display: flex;
  align-items: center;
}

.event-badge {
  flex-shrink: 0;
}

.event-badge .badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* Responsive */
@media (max-width: 576px) {
  .event-meta {
    flex-direction: column;
    gap: 0.25rem;
  }

  .panel-header,
  .panel-body {
    padding: 0.75rem;
  }

  .event-item {
    padding: 0.5rem;
  }
}
</style>