<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'calendar-alt']" />
          Liste der Tage </h3>
        <p class="mb-0 mt-2">{{ formattedCurrentDate }}</p>
      </div>
      <div class="card-body">
        <div id="alertContainer"></div>

        <div v-if="loadingInitialData || configLoading" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span> </div>
          <p class="text-muted">Lade {{ configLoading ? 'Konfiguration' : 'Tagesdaten' }}...</p> </div>

        <div v-else-if="configError" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" />
          <h5 class="text-muted">Konfiguration konnte nicht geladen werden.</h5> <p class="text-muted">Fehler: {{ configError.message }}. Standardwerte werden verwendet.</p> </div>

        <div v-else>
          <ul class="list-group list-group-flush children-list">
            <li v-if="days.length === 0" class="list-group-item text-center text-muted">
              Keine Tage gespeichert. </li>

            <li v-for="day in days" :key="day.id" class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{{ day.date }}</strong> - {{ day.name || 'Ohne Namen' }}
                <span class="badge bg-primary ms-2">{{ day.abfahrt.substring(0, 5) }} - {{ day.ankommen.substring(0, 5) }}</span>
                <p v-if="day.description" class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Beschreibung: {{ day.description.substring(0, 50) + (day.description.length > 50 ? '...' : '') }} </p>
                <p v-else class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Keine Beschreibung </p>
              </div>

              <div class="d-flex">
                <button class="btn btn-outline-primary btn-sm me-2" @click="editDay(day.id)" title="Tag bearbeiten"> <font-awesome-icon :icon="['fas', 'edit']" />
                </button>
                <button class="btn btn-outline-danger btn-sm" @click="removeDay(day.id, day.date)" title="Tag löschen"> <font-awesome-icon :icon="['fas', 'trash-alt']" />
                </button>
              </div>
            </li>
          </ul>

          <div class="d-grid gap-2 mt-4">
            <button class="btn btn-secondary btn-lg" @click="goBack" disabled>
              <font-awesome-icon :icon="['fas', 'arrow-left']" />
              Zurück (Inaktiv) </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'calendar-plus']" />
          {{ editingDayId !== null ? 'Tag bearbeiten:' : 'Tag hinzufügen / bearbeiten' }} </h3>
      </div>
      <div class="card-body">
        <div id="formAlertContainer"></div>

        <form @submit.prevent="saveDay">

          <div class="mb-3">
            <label for="newDayDate" class="form-label">Datum <span class="text-danger">*</span></label>
            <input
                type="date"
                id="newDayDate"
                class="form-control"
                v-model="newDayDate"
                required
            >
          </div>

          <div class="mb-3">
            <label for="newDayName" class="form-label">Reiseziel</label> <input
              type="text"
              id="newDayName"
              class="form-control"
              v-model="newDayName"
              placeholder="Moviepark, Dortmund Zoo, Schwimmbad in Hamm..." >
          </div>

          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="newDayAbfahrt" class="form-label">Abfahrtszeit <span class="text-danger">*</span></label> <input
                type="time"
                id="newDayAbfahrt"
                class="form-control"
                v-model="newDayAbfahrt"
                required
            >
            </div>
            <div class="col-md-6 mb-3">
              <label for="newDayAnkommen" class="form-label">Ankunftszeit  <span class="text-danger">*</span></label> <input
                type="time"
                id="newDayAnkommen"
                class="form-control"
                v-model="newDayAnkommen"
                required
            >
            </div>
          </div>

          <div class="mb-4">
            <label for="newDayDescription" class="form-label">Beschreibung</label> <textarea
              id="newDayDescription"
              class="form-control"
              v-model="newDayDescription"
              rows="3"
              placeholder="Details zu den Aktivitäten des Tages" ></textarea>
          </div>

          <div class="d-flex justify-content-between">
            <button type="submit" class="btn btn-primary btn-lg flex-grow-1 me-2" :disabled="configLoading">
              <font-awesome-icon :icon="['fas', editingDayId !== null ? 'save' : 'plus']" />
              {{ editingDayId !== null ? 'Speichern' : 'Hinzufügen' }} </button>
            <button v-if="editingDayId !== null" type="button" class="btn btn-outline-secondary btn-lg" @click="cancelEdit">
              Abbrechen </button>
            <button v-else type="button" class="btn btn-outline-secondary btn-lg" @click="resetForm">
              <font-awesome-icon :icon="['fas', 'eraser']" />
              Löschen </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
// --- USE YOUR config.js ---
import { useConfig } from '@/modules/config'; // Assuming path '@/config'
// ---------------------------------

import { useDays } from '@/composables/useDays';


// --- Utilities for styles and notifications (taken from GroupEditView.vue) ---
const Utils = {
  showAlert(message, type = 'info', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;

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
  getCurrentDateString() {
    // Format 'yyyy-mm-dd', as required for public.days.date by default
    return new Date().toISOString().split('T')[0];
  },
  formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    // Use German locale for display
    return date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  },
};

export default {
  name: 'DaysEditView',

  setup() {
    // Use the composables we created
    const { fetchDaysList, saveDay, deleteDay } = useDays();
    // Get reactive config state and load function
    const { config, loadConfig, loading: configLoading, error: configError } = useConfig();

    return {
      fetchDaysList, saveDay, deleteDay,
      // Add config functions and state to component context
      config, loadConfig, configLoading, configError
    };
  },

  data() {
    return {
      // isConfigLoaded can now be replaced by !this.configLoading && !this.configError,
      // but to match GroupEditView.vue we will keep the flag that we will set
      isConfigLoaded: true,
      loadingInitialData: true,

      // Data for Days form fields
      newDayDate: Utils.getCurrentDateString(), // Current date by default
      newDayName: '',
      newDayAbfahrt: '', // Default from config.value("abfahrtszeit")
      newDayAnkommen: '', // Default from config.value("ankunftszeit")
      newDayDescription: '',

      // State for editing
      editingDayId: null,

      formattedCurrentDate: '',
      days: [], // List of days
    };
  },

  async created() {
    this.formattedCurrentDate = Utils.formatDateForDisplay(Utils.getCurrentDateString());

    // 1. First load configuration
    await this.loadConfig(); // loadConfig from useConfig

    // 2. Set defaults and load days data
    this.setDefaultsFromConfig();
    await this.loadInitialData();
  },

  methods: {
    showAlert: Utils.showAlert,

    /**
     * Sets default abfahrt and ankommen values from the reactive config object.
     */
    setDefaultsFromConfig() {
      // config is a reactive object (Proxy) that contains data from configData
      const abfahrtTime = this.config.abfahrtszeit;
      const ankommenTime = this.config.ankunftszeit;

      // Apply them only if there is no active editing,
      // so as not to overwrite values when editing.
      if (this.editingDayId === null) {
        this.newDayAbfahrt = abfahrtTime || '08:00';
        this.newDayAnkommen = ankommenTime || '17:00';
      }

      // Set isConfigLoaded for UI display
      this.isConfigLoaded = !this.configError;

      if (this.configError) {
        this.showAlert(`Fehler beim Laden der Konfiguration: ${this.configError.message}. Standardwerte (08:00/17:00) wurden verwendet.`, 'warning'); // Error message translated
      } else if (!abfahrtTime || !ankommenTime) {
        // Show warning if config does not contain required keys, but loading error did not occur
        this.showAlert(`Die Schlüssel 'abfahrtszeit' oder 'ankunftszeit' wurden in der Supabase-Konfiguration nicht gefunden. Standardwerte (08:00/17:00) wurden verwendet.`, 'warning'); // Warning message translated
      }
    },

    async loadInitialData() {
      this.loadingInitialData = true;

      try {
        const data = await this.fetchDaysList(); // fetchDaysList from useDays.js
        this.days = data;
        this.showAlert(`Tagesdaten wurden von Supabase geladen.`, 'info'); // Success message translated
      } catch (error) {
        this.showAlert(`Fehler beim Laden der Tagesdaten: ${error.message}`, 'danger'); // Error message translated
      } finally {
        this.loadingInitialData = false;
      }
    },

    resetForm() {
      this.editingDayId = null;
      this.newDayDate = Utils.getCurrentDateString();
      this.newDayName = '';
      this.newDayDescription = '';
      // Reset time to config default
      this.setDefaultsFromConfig();
    },

    cancelEdit() {
      this.resetForm();
      this.showAlert('Bearbeitung abgebrochen.', 'info', 'formAlertContainer'); // Message translated
    },

    validateDayData() {
      const date = this.newDayDate;
      const abfahrt = this.newDayAbfahrt;
      const ankommen = this.newDayAnkommen;

      if (!date) {
        this.showAlert('Bitte wählen Sie ein Datum aus.', 'warning', 'formAlertContainer'); // Message translated
        return false;
      }
      if (!abfahrt || !ankommen) {
        this.showAlert('Bitte geben Sie die Abfahrts- und Ankunftszeit an.', 'warning', 'formAlertContainer'); // Message translated
        return false;
      }

      return true;
    },

    async saveDay() {
      if (!this.validateDayData()) {
        return;
      }

      const dayData = {
        date: this.newDayDate,
        name: this.newDayName.trim(),
        abfahrt: this.newDayAbfahrt,
        ankommen: this.newDayAnkommen,
        description: this.newDayDescription.trim(),
      };

      if (this.editingDayId !== null) {
        dayData.id = this.editingDayId;
      }

      try {
        const { data, message } = await this.saveDay(dayData);

        // Update data in local array
        if (this.editingDayId !== null) {
          const index = this.days.findIndex(d => d.id === this.editingDayId);
          if (index !== -1) {
            this.days.splice(index, 1, data);
          }
        } else {
          this.days.push(data);
        }

        // Sort by date for correct display
        this.days.sort((a, b) => new Date(a.date) - new Date(b.date));

        this.showAlert(message, 'success');
        this.resetForm();
      } catch (error) {
        this.showAlert(`Fehler beim Speichern: ${error.message}`, 'danger', 'formAlertContainer'); // Error message translated
      }
    },

    editDay(dayId) {
      this.editingDayId = dayId;
      const dayToEdit = this.days.find(d => d.id === dayId);

      if (dayToEdit) {
        // Fill form
        this.newDayDate = dayToEdit.date;
        this.newDayName = dayToEdit.name || '';
        this.newDayAbfahrt = dayToEdit.abfahrt;
        this.newDayAnkommen = dayToEdit.ankommen;
        this.newDayDescription = dayToEdit.description || '';

        document.getElementById('newDayDate').focus();
        this.showAlert(`Der Tag "${dayToEdit.date}" wurde zum Bearbeiten geladen.`, 'info', 'formAlertContainer'); // Message translated
      }
    },

    async removeDay(dayId, dayDate) {
      if (confirm(`Möchten Sie den Tag "${dayDate}" wirklich löschen?`)) { // Confirmation message translated
        try {
          await this.deleteDay(dayId);

          // Local deletion
          const index = this.days.findIndex(d => d.id === dayId);
          if (index !== -1) {
            this.days.splice(index, 1);
          }

          if (this.editingDayId === dayId) {
            this.resetForm();
          }

          this.showAlert(`Der Tag "${dayDate}" wurde erfolgreich gelöscht.`, 'success'); // Success message translated
        } catch (error) {
          this.showAlert(`Fehler beim Löschen des Tages: ${error.message}`, 'danger'); // Error message translated
        }
      }
    },

    goBack() {
      alert('Zurück-Navigation (Emulation): Zurück zur vorherigen Ansicht.'); // Alert message translated
    }
  }
};
</script>

<style>
/* Styles remain unchanged as they do not contain user-facing text */
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