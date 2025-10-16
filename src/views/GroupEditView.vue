<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'children']" />
          Gruppe {{ groupNumber }}. Kinder
        </h3>
      </div>
      <div class="card-body">
        <div id="alertContainer"></div>

        <div v-if="loadingInitialData" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Kinderdaten...</p>
        </div>

        <div v-else-if="!isConfigLoaded" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" />
          <h5 class="text-muted">Konfiguration konnte nicht geladen werden.</h5>
          <p class="text-muted">Bitte gehen Sie zur Anmeldeseite zurück, um die Konfiguration zu laden.</p>
        </div>

        <div v-else>
          <ul class="list-group list-group-flush children-list">
            <li v-if="children.length === 0" class="list-group-item text-center text-muted">
              Keine Kinder in dieser Gruppe.
            </li>

            <li v-for="child in children" :key="child.id" class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{{ child.name }}</strong> ({{ child.age }} J.) -
                <span class="badge" :class="getSwimBadgeClass(child.schwimmer)">
                  {{ getSwimLevel(child.schwimmer) }}
                </span>
                <p v-if="child.notes && child.notes.trim() !== '\u0022\u0022' && child.notes.trim().length > 0" class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Notizen: {{ child.notes }}
                </p>
              </div>

              <div class="d-flex">
                <button class="btn btn-outline-primary btn-sm me-2" @click="editChild(child)" title="Kind bearbeiten">
                  <font-awesome-icon :icon="['fas', 'edit']" />
                </button>
                <button class="btn btn-outline-danger btn-sm" @click="removeChild(child.id, child.name)" title="Kind entfernen">
                  <font-awesome-icon :icon="['fas', 'trash-alt']" />
                </button>
              </div>
            </li>
          </ul>

          <div class="d-grid gap-2 mt-4">
            <button class="btn btn-success btn-lg" @click="openAddChildModal">
              <font-awesome-icon :icon="['fas', 'plus']" />
              Neues Kind hinzufügen
            </button>

            <button class="btn btn-secondary btn-lg" @click="goBack">
              <font-awesome-icon :icon="['fas', 'arrow-left']" />
              Zurück zur Auswahl
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Child Modal -->
    <AddEditChildModal
        :show="showChildModal"
        :child-data="selectedChild"
        :group-id="parseInt(groupNumber)"
        @close="closeChildModal"
        @saved="onChildSaved"
    />
  </div>
</template>

<script>
import { useChildren } from '@/composables/useChildren'
import AddEditChildModal from '@/components/AddEditChildModal.vue'
import Utils from '@/utils/Utils'

export default {
  name: 'GroupEditView',
  components: {
    AddEditChildModal
  },
  setup() {
    const { fetchChildrenList, deleteChild } = useChildren()
    return { fetchChildrenList, deleteChild }
  },

  data() {
    return {
      isConfigLoaded: true,
      loadingInitialData: true,
      groupNumber: '1', // Wird in created() aus route.params gesetzt
      formattedCurrentDate: '',
      allChildrenData: [],

      // Modal state
      showChildModal: false,
      selectedChild: null
    }
  },
  computed: {
    children() {
      const groupID = parseInt(this.groupNumber)
      return (this.allChildrenData || []).filter(child => child.group_id === groupID)
    }
  },
  async created() {
    this.formattedCurrentDate = Utils.formatDateForDisplay(Utils.getCurrentDateString())

    // Получаем ID группы из route params (вместо query)
    this.groupNumber = this.$route.params.id || '1'

    await this.loadInitialData()
  },
  methods: {
    getSwimLevel: Utils.getSwimLevel,
    getSwimBadgeClass: Utils.getSwimBadgeClass,
    showAlert: Utils.showAlert,

    async loadInitialData() {
      this.loadingInitialData = true
      try {
        const data = await this.fetchChildrenList()
        this.allChildrenData = data
        this.showAlert(`Daten für Gruppe ${this.groupNumber} von Supabase geladen.`, 'info')
      } catch (error) {
        this.showAlert(`Fehler beim Laden der Kinderdaten: ${error.message}`, 'danger')
        this.isConfigLoaded = false
      } finally {
        this.loadingInitialData = false
      }
    },

    openAddChildModal() {
      this.selectedChild = null
      this.showChildModal = true
    },

    editChild(child) {
      this.selectedChild = child
      this.showChildModal = true
    },

    closeChildModal() {
      this.showChildModal = false
      this.selectedChild = null
    },

    onChildSaved(savedChild) {
      if (this.selectedChild && this.selectedChild.id) {
        // Update existing child
        const index = this.allChildrenData.findIndex(c => c.id === savedChild.id)
        if (index !== -1) {
          this.allChildrenData.splice(index, 1, savedChild)
        }
        this.showAlert(`Kind "${savedChild.name}" erfolgreich aktualisiert.`, 'success')
      } else {
        // Add new child
        this.allChildrenData.push(savedChild)
        this.showAlert(`Kind "${savedChild.name}" erfolgreich hinzugefügt.`, 'success')
      }
    },

    async removeChild(childId, childName) {
      if (confirm(`Möchten Sie das Kind "${childName}" (ID: ${childId}) wirklich entfernen?`)) {
        try {
          await this.deleteChild(childId)

          const index = this.allChildrenData.findIndex(c => c.id === childId)
          if (index !== -1) {
            this.allChildrenData.splice(index, 1)
          }

          this.showAlert(`Kind "${childName}" erfolgreich entfernt.`, 'success')
        } catch (error) {
          this.showAlert(`Fehler beim Entfernen des Kindes: ${error.message}`, 'danger')
        }
      }
    },

    goBack() {
      this.$router.push('/main')
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
  border-radius: 0.25rem;
  padding: 0;
}

.list-group-item {
  padding: 15px 20px;
  font-size: 1.1em;
  transition: background-color 0.3s;
}

.list-group-item:hover {
  background-color: #f1f1f1;
}

.list-group-item .btn {
  margin-left: 10px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.list-group-item .btn-outline-primary {
  color: #007bff;
  border-color: #007bff;
}

.list-group-item .btn-outline-danger {
  color: #dc3545;
  border-color: #dc3545;
}

.btn-secondary {
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #5a6268;
  border-color: #545b62;
}

.btn-success {
  background-color: #28a745;
  border-color: #28a745;
}

.btn-success:hover {
  background-color: #218838;
  border-color: #1e7e34;
}
</style>