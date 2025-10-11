<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'child']" />
          Kinderliste für Gruppe {{ groupNumber }}
        </h3>
        <p class="mb-0 mt-2">{{ formattedCurrentDate }}</p>
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
                <p v-if="child.notes && child.notes.trim() !== ''" class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                Notizen: {{ child.notes }}
                </p>
                <p v-else class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Keine Notizen
                </p>
              </div>

              <div class="d-flex">
                <button class="btn btn-outline-primary btn-sm me-2" @click="editChild(child.id)" title="Kind bearbeiten">
                  <font-awesome-icon :icon="['fas', 'edit']" />
                </button>
                <button class="btn btn-outline-danger btn-sm" @click="removeChild(child.id, child.name)" title="Kind entfernen">
                  <font-awesome-icon :icon="['fas', 'trash-alt']" />
                </button>
              </div>
            </li>
          </ul>

          <div class="d-grid gap-2 mt-4">
            <button class="btn btn-secondary btn-lg" @click="goBack">
              <font-awesome-icon :icon="['fas', 'arrow-left']" />
              Zurück zur Auswahl
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'child']" />
          {{ editingChildId !== null ? 'Kind bearbeiten:' : 'Neues Kind hinzufügen:' }}
        </h3>
      </div>
      <div class="card-body">
        <div id="formAlertContainer"></div>

        <form @submit.prevent="saveChild">
          <div class="mb-3">
            <label for="newChildName" class="form-label">Name <span class="text-danger">*</span></label>
            <input
                type="text"
                id="newChildName"
                class="form-control"
                v-model="newChildName"
                placeholder="Name des Kindes"
                required
            >
          </div>

          <div class="row">
            <div class="col-md-4 mb-3">
              <label for="newChildAge" class="form-label">Alter <span class="text-danger">*</span></label>
              <input
                  type="number"
                  id="newChildAge"
                  class="form-control"
                  v-model.number="newChildAge"
                  placeholder="Alter"
                  min="0"
                  required
              >
            </div>
            <div class="col-md-4 mb-3">
              <label for="newChildSchwimm" class="form-label">Schwimmer (Level 0-4) <span class="text-danger">*</span></label>
              <select
                  id="newChildSchwimm"
                  class="form-select"
                  v-model.number="newChildSchwimm"
                  required
              >
                <option :value="0">0 - Nichtschwimmer</option>
                <option :value="1">1 - Seepferdchen</option>
                <option :value="2">2 - Bronze</option>
                <option :value="3">3 - Silber</option>
                <option :value="4">4 - Gold</option>
              </select>
            </div>
            <div class="col-md-4 mb-3">
              <label for="newChildBandId" class="form-label">Armband Code (optional)</label>
              <input
                  type="text"
                  id="newChildBandId"
                  class="form-control"
                  v-model="newChildBandId"
                  placeholder="z.B. 123456789"
              >
            </div>
          </div>

          <div class="mb-4">
            <label for="newChildNotes" class="form-label">Notizen</label>
            <input
                type="text"
                id="newChildNotes"
                class="form-control"
                v-model="newChildNotes"
                placeholder="Besondere Hinweise (Allergien, Medikamente etc.)"
            >
          </div>

          <div class="d-flex justify-content-between">
            <button type="submit" class="btn btn-primary btn-lg flex-grow-1 me-2">
              <font-awesome-icon :icon="['fas', editingChildId !== null ? 'save' : 'add']" />
              {{ editingChildId !== null ? 'Speichern' : 'Kind hinzufügen' }}
            </button>
            <button v-if="editingChildId !== null" type="button" class="btn btn-outline-secondary btn-lg" @click="cancelEdit">
              Abbrechen
            </button>
            <button v-else type="button" class="btn btn-outline-secondary btn-lg" @click="resetForm">
              <font-awesome-icon :icon="['fas', 'eraser']" />
              Formular leeren
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
// Import des Composables für die Datenbankverbindung
import { useChildren } from '@/composables/useChildren';

// --- Statische Daten für die Anzeige ---
const SWIM_LEVELS = {
  0: 'Nichtschwimmer',
  1: 'Seepferdchen',
  2: 'Bronze',
  3: 'Silber',
  4: 'Gold',
};
const SWIM_BADGE_CLASSES = {
  0: 'bg-danger text-white',
  1: 'bg-warning text-dark',
  2: 'bg-info text-white',
  3: 'bg-secondary text-white',
  4: 'bg-success text-white',
};

const Utils = {
  // Helferfunktionen für Schwimmabzeichen (jetzt ohne 'this' in der Definition)
  getSwimLevel(level) {
    return SWIM_LEVELS[level] || 'Unbekannt';
  },
  getSwimBadgeClass(level) {
    return SWIM_BADGE_CLASSES[level] || 'bg-light text-dark';
  },

  // Vorgegebene Hilfsfunktionen
  getCurrentDateString() {
    return new Date().toISOString().split('T')[0];
  },
  formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  },
  // Vcплывающее сообщение (упрощенная версия для Vue компонента)
  showAlert(message, type = 'info', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;

    // Zuerst alle Alerts im Container entfernen
    alertContainer.innerHTML = '';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  },
};

export default {
  name: 'GroupEditView',
  // Initialisierung des Composables
  setup() {
    const { fetchChildrenList, saveChild, deleteChild } = useChildren();
    return { fetchChildrenList, saveChild, deleteChild };
  },

  data() {
    return {
      // Zustand der Anwendung
      isConfigLoaded: true,
      loadingInitialData: true,

      // Aus der URL
      groupNumber: this.$route.query ? this.$route.query.gr || '1' : '1',

      // Daten für die Formularfelder
      newChildName: '',
      newChildAge: '',
      newChildSchwimm: 0,
      newChildNotes: '',
      newChildBandId: '',

      // Zustand für Bearbeitung
      editingChildId: null, // ID des zu bearbeitenden Kindes. null für Hinzufügen.

      formattedCurrentDate: '',
      allChildrenData: [], // Hier werden ALLE Kinder von Supabase gespeichert
    };
  },
  computed: {
    children() {
      // Kinder der aktuellen Gruppe filtern
      const groupID = parseInt(this.groupNumber);
      return (this.allChildrenData || []).filter(child => child.group_id === groupID);
    }
  },
  async created() {
    this.formattedCurrentDate = Utils.formatDateForDisplay(Utils.getCurrentDateString());
    this.groupNumber = String(this.groupNumber);
    await this.loadInitialData();
  },
  methods: {
    getSwimLevel: Utils.getSwimLevel,
    getSwimBadgeClass: Utils.getSwimBadgeClass,
    showAlert: Utils.showAlert,

    // --- CRUD / Daten-Methoden ---

    async loadInitialData() {
      this.loadingInitialData = true;
      try {
        // Ruft alle Kinder aus der Datenbank ab
        const data = await this.fetchChildrenList();
        this.allChildrenData = data;
        this.showAlert(`Daten für Gruppe ${this.groupNumber} von Supabase geladen.`, 'info');
      } catch (error) {
        this.showAlert(`Fehler beim Laden der Kinderdaten: ${error.message}`, 'danger');
        this.isConfigLoaded = false;
      } finally {
        this.loadingInitialData = false;
      }
    },

    resetForm() {
      this.newChildName = '';
      this.newChildAge = '';
      this.newChildSchwimm = 0;
      this.newChildNotes = '';
      this.newChildBandId = '';
      this.editingChildId = null;
    },

    cancelEdit() {
      this.resetForm();
      this.showAlert('Bearbeitung abgebrochen.', 'info', 'formAlertContainer');
    },

    validateChildData() {
      const name = this.newChildName.trim();
      const age = this.newChildAge;
      const schwimmer = this.newChildSchwimm;
      const bandId = this.newChildBandId;

      if (!name) {
        this.showAlert('Bitte geben Sie einen Namen für das Kind ein.', 'warning', 'formAlertContainer');
        return false;
      }
      if (!Number.isInteger(Number(age)) || Number(age) <= 0 || Number(age) > 99) {
        this.showAlert('Bitte geben Sie ein gültiges Alter (positive Zahl bis 99) ein.', 'warning', 'formAlertContainer');
        return false;
      }
      if (!Number.isInteger(Number(schwimmer)) || Number(schwimmer) < 0 || Number(schwimmer) > 4) {
        this.showAlert('Bitte wählen Sie ein gültiges Schwimmer-Level (0 bis 4).', 'warning', 'formAlertContainer');
        return false;
      }
      // Validiere Band-ID, falls angegeben
      if (bandId && (isNaN(Number(bandId)) || !Number.isInteger(Number(bandId)) || Number(bandId) <= 0)) {
        this.showAlert('Armband Code muss eine positive Ganzzahl sein.', 'warning', 'formAlertContainer');
        return false;
      }

      return true;
    },

    async saveChild() {
      if (!this.validateChildData()) {
        return;
      }

      const childData = {
        name: this.newChildName.trim(),
        age: parseInt(this.newChildAge),
        schwimmer: parseInt(this.newChildSchwimm),
        notes: this.newChildNotes.trim(),
        group_id: parseInt(this.groupNumber),
        band_id: this.newChildBandId ? String(this.newChildBandId) : null,
      };

      if (this.editingChildId !== null) {
        childData.id = this.editingChildId;
      }

      try {
        const { data, message } = await this.saveChild(childData);

        // Daten im lokalen Array aktualisieren
        if (this.editingChildId !== null) {
          const index = this.allChildrenData.findIndex(c => c.id === this.editingChildId);
          if (index !== -1) {
            this.allChildrenData.splice(index, 1, data); // Ersetzen
          }
        } else {
          this.allChildrenData.push(data); // Hinzufügen
        }

        this.showAlert(message, 'success');
        this.resetForm();
      } catch (error) {
        this.showAlert(`Fehler beim Speichern: ${error.message}`, 'danger', 'formAlertContainer');
      }
    },

    editChild(childId) {
      this.editingChildId = childId;
      const childToEdit = this.allChildrenData.find(c => c.id === childId);

      if (childToEdit) {
        // Formular füllen
        this.newChildName = childToEdit.name;
        this.newChildAge = childToEdit.age;
        this.newChildSchwimm = childToEdit.schwimmer;
        this.newChildNotes = childToEdit.notes && childToEdit.notes.trim() !== '""' ? childToEdit.notes : '';
        this.newChildBandId = childToEdit.band_id || '';

        document.getElementById('newChildName').focus();
        this.showAlert(`Kind "${childToEdit.name}" zum Bearbeiten geladen.`, 'info', 'formAlertContainer');
      }
    },

    async removeChild(childId, childName) {
      if (confirm(`Möchten Sie das Kind "${childName}" (ID: ${childId}) wirklich entfernen?`)) {
        try {
          await this.deleteChild(childId);

          // Lokales Entfernen
          const index = this.allChildrenData.findIndex(c => c.id === childId);
          if (index !== -1) {
            this.allChildrenData.splice(index, 1);
          }

          // Wenn das entfernte Kind dasjenige war, das gerade bearbeitet wird, den Bearbeitungsmodus beenden
          if (this.editingChildId === childId) {
            this.resetForm();
          }

          this.showAlert(`Kind "${childName}" erfolgreich entfernt.`, 'success');
        } catch (error) {
          this.showAlert(`Fehler beim Entfernen des Kindes: ${error.message}`, 'danger');
        }
      }
    },

    goBack() {
      alert('Zurück-Navigation (Emulation): Rückkehr zur Gruppenauswahl.');
    }
  }
};
</script>

<style>
/* ... (Der Stilblock bleibt unverändert) ... */
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

.card + .card {
  margin-top: 20px;
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
</style>