<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'child-reaching']" />
          {{ headerTitle }}
        </h3>
        <p class="mb-0 mt-2 small" v-if="groupNumber">
          Gruppe {{ groupNumber }}
        </p>
      </div>

      <div class="card-body">
        <div id="alertContainer"></div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Kinderliste...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-danger fa-3x mb-3" />
          <h5 class="text-muted">{{ error }}</h5>
          <button class="btn btn-primary mt-3" @click="loadChildren">
            <font-awesome-icon :icon="['fas', 'refresh']" />
            Erneut versuchen
          </button>
        </div>

        <!-- Empty State -->
        <div v-else-if="children.length === 0" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'child']" class="text-muted fa-3x mb-3" />
          <h5 class="text-muted">Keine Kinder in dieser Gruppe gefunden.</h5>
          <p class="text-muted">Bitte überprüfen Sie Ihre Gruppenzuordnung.</p>
        </div>

        <!-- Children List -->
        <div v-else>
          <!-- Search/Filter -->
          <div v-if="showSearch" class="mb-3">
            <input
                type="text"
                class="form-control"
                v-model="searchQuery"
                placeholder="Kind suchen..."
            >
          </div>

          <!-- Select All (only for multi mode) -->
          <div v-if="mode === 'multi'" class="mb-3 d-flex justify-content-between align-items-center">
            <div class="form-check">
              <input
                  class="form-check-input"
                  type="checkbox"
                  id="selectAll"
                  v-model="selectAll"
                  @change="toggleSelectAll"
              >
              <label class="form-check-label fw-bold" for="selectAll">
                Alle auswählen
              </label>
            </div>
            <span class="badge bg-primary">
              {{ selectedChildren.length }} ausgewählt
            </span>
          </div>

          <!-- Children List -->
          <div class="children-list">
            <div
                v-for="child in filteredChildren"
                :key="child.id"
                class="child-item"
                :class="{ 'selected': isChildSelected(child.id) }"
                @click="toggleChild(child.id)"
            >
              <div class="form-check">
                <input
                    class="form-check-input"
                    :type="mode === 'single' ? 'radio' : 'checkbox'"
                    :id="`child-${child.id}`"
                    :name="mode === 'single' ? 'selectedChild' : undefined"
                    :checked="isChildSelected(child.id)"
                    @click.stop
                    @change="toggleChild(child.id)"
                >
                <label class="form-check-label w-100" :for="`child-${child.id}`">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{{ child.name }}</strong>
                      <span class="text-muted ms-2">({{ child.age }} J.)</span>
                    </div>
                    <span class="badge" :class="getSwimBadgeClass(child.schwimmer)">
                      {{ getSwimLevel(child.schwimmer) }}
                    </span>
                  </div>
                  <small v-if="child.notes && child.notes.trim() !== '' && child.notes.trim().length > 0" class="text-muted d-block mt-1">
                  {{ child.notes }}
                  </small>
                </label>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="d-grid gap-2 mt-4">
            <button
                class="btn btn-primary btn-lg"
                @click="confirmSelection"
                :disabled="!hasSelection"
            >
              <font-awesome-icon :icon="['fas', 'check']" />
              {{ confirmButtonText }}
            </button>

            <button class="btn btn-secondary btn-lg" @click="goBack">
              <font-awesome-icon :icon="['fas', 'arrow-left']" />
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useChildren } from '@/composables/useChildren'
import { useUserStore } from '@/stores/user'

// --- Static data for swim levels ---
const SWIM_LEVELS = {
  0: 'Nichtschwimmer',
  1: 'Seepferdchen',
  2: 'Bronze',
  3: 'Silber',
  4: 'Gold',
}
const SWIM_BADGE_CLASSES = {
  0: 'bg-danger text-white',
  1: 'bg-warning text-dark',
  2: 'bg-secondary text-warning',
  3: 'bg-light text-secondary',
  4: 'bg-dark text-warning',
}

export default {
  name: 'SelectChildView',
  props: {
    mode: {
      type: String,
      default: 'single', // 'single' or 'multi'
      validator: (value) => ['single', 'multi'].includes(value)
    },
    headerTitle: {
      type: String,
      default: 'Kind auswählen'
    },
    confirmButtonText: {
      type: String,
      default: 'Auswahl bestätigen'
    },
    showSearch: {
      type: Boolean,
      default: true
    },
    preselectedIds: {
      type: Array,
      default: () => []
    }
  },
  emits: ['selected', 'cancelled'],
  setup() {
    const { fetchChildrenList } = useChildren()
    const userStore = useUserStore()
    return { fetchChildrenList, userStore }
  },
  data() {
    return {
      children: [],
      selectedChildren: [...this.preselectedIds],
      loading: true,
      error: null,
      searchQuery: '',
      selectAll: false
    }
  },
  computed: {
    groupNumber() {
      return this.userStore.userInfo.group_id
    },
    filteredChildren() {
      if (!this.searchQuery.trim()) {
        return this.children
      }
      const query = this.searchQuery.toLowerCase()
      return this.children.filter(child =>
          child.name.toLowerCase().includes(query) ||
          (child.notes && child.notes.toLowerCase().includes(query))
      )
    },
    hasSelection() {
      return this.selectedChildren.length > 0
    }
  },
  watch: {
    preselectedIds: {
      immediate: true,
      handler(newVal) {
        this.selectedChildren = [...newVal]
      }
    }
  },
  async created() {
    await this.loadChildren()
  },
  methods: {
    getSwimLevel(level) {
      return SWIM_LEVELS[level] || 'Unbekannt'
    },
    getSwimBadgeClass(level) {
      return SWIM_BADGE_CLASSES[level] || 'bg-light text-dark'
    },

    async loadChildren() {
      this.loading = true
      this.error = null

      try {
        // Check if user has group assigned
        if (!this.groupNumber) {
          throw new Error('Sie sind keiner Gruppe zugeordnet.')
        }

        // Fetch all children
        const allChildren = await this.fetchChildrenList()

        // Filter by current user's group
        this.children = allChildren.filter(child => child.group_id === this.groupNumber)

        if (this.children.length === 0) {
          this.showAlert('Keine Kinder in Ihrer Gruppe gefunden.', 'warning')
        }
      } catch (err) {
        console.error('Error loading children:', err)
        this.error = err.message || 'Fehler beim Laden der Kinderliste.'
        this.showAlert(this.error, 'danger')
      } finally {
        this.loading = false
      }
    },

    isChildSelected(childId) {
      return this.selectedChildren.includes(childId)
    },

    toggleChild(childId) {
      if (this.mode === 'single') {
        // Single selection mode - replace selection
        this.selectedChildren = [childId]
      } else {
        // Multi selection mode - toggle
        const index = this.selectedChildren.indexOf(childId)
        if (index > -1) {
          this.selectedChildren.splice(index, 1)
        } else {
          this.selectedChildren.push(childId)
        }
      }

      // Update selectAll state
      this.updateSelectAllState()
    },

    toggleSelectAll() {
      if (this.selectAll) {
        // Select all visible children
        this.selectedChildren = this.filteredChildren.map(child => child.id)
      } else {
        // Deselect all
        this.selectedChildren = []
      }
    },

    updateSelectAllState() {
      if (this.mode === 'multi') {
        this.selectAll = this.filteredChildren.length > 0 &&
            this.filteredChildren.every(child => this.isChildSelected(child.id))
      }
    },

    confirmSelection() {
      if (!this.hasSelection) {
        this.showAlert('Bitte wählen Sie mindestens ein Kind aus.', 'warning')
        return
      }

      // Get full child objects for selected IDs
      const selectedChildrenData = this.children.filter(child =>
          this.selectedChildren.includes(child.id)
      )

      // Emit event with selected children
      this.$emit('selected', {
        ids: this.selectedChildren,
        children: selectedChildrenData,
        mode: this.mode
      })
    },

    goBack() {
      this.$emit('cancelled')
    },

    showAlert(message, type = 'info') {
      const alertContainer = document.getElementById('alertContainer')
      if (!alertContainer) return

      alertContainer.innerHTML = ''

      const alertDiv = document.createElement('div')
      alertDiv.className = `alert alert-${type} alert-dismissible fade show`
      alertDiv.role = 'alert'
      alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `
      alertContainer.appendChild(alertDiv)

      setTimeout(() => {
        alertDiv.remove()
      }, 5000)
    }
  }
}
</script>

<style scoped>
.main-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa;
}

.card {
  width: 100%;
  max-width: 650px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card-header {
  background-color: #007bff;
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}

.children-list {
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  overflow: hidden;
}

.child-item {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
}

.child-item:last-child {
  border-bottom: none;
}

.child-item:hover {
  background-color: #f8f9fa;
}

.child-item.selected {
  background-color: #e7f3ff;
  border-left: 4px solid #007bff;
}

.child-item .form-check {
  margin: 0;
  min-height: auto;
}

.child-item .form-check-input {
  cursor: pointer;
  margin-top: 0.25rem;
}

.child-item .form-check-label {
  cursor: pointer;
  margin-left: 0.5rem;
}

.form-control:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.badge {
  font-size: 0.75rem;
  padding: 0.35em 0.65em;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 576px) {
  .child-item {
    padding: 0.875rem 1rem;
  }

  .badge {
    font-size: 0.7rem;
  }
}
</style>