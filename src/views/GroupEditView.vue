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
          <h5 class="text-muted">Konfiguration konnte nicht geladen werden. (Синтетическая Fehler)</h5>
          <p class="text-muted">Bitte gehen Sie zur Anmeldeseite zurück, um die Konfiguration zu laden.</p>
        </div>

        <div v-else>
          <ul class="list-group list-group-flush children-list">
            <li v-if="children.length === 0" class="list-group-item text-center text-muted">
              Keine Kinder in dieser Gruppe.
            </li>

            <li v-for="(child, index) in children" :key="index" class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{{ child.name }}</strong> ({{ child.age }} J.) -
                <span class="badge" :class="getSwimBadgeClass(child.schwimmer)">
                  {{ getSwimLevel(child.schwimmer) }}
                </span>
                <p v-if="child.notes" class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Notizen: {{ child.notes }}
                </p>
                <p v-else class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Keine Notizen
                </p>
              </div>

              <div class="d-flex">
                <button class="btn btn-outline-primary btn-sm me-2" @click="editChild(index)" title="Kind bearbeiten">
                  <font-awesome-icon :icon="['fas', 'edit']" />
                </button>
                <button class="btn btn-outline-danger btn-sm" @click="removeChild(index)" title="Kind entfernen">
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
          {{ editingChildIndex !== null ? 'Kind bearbeiten:' : 'Neues Kind hinzufügen:' }}
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
            <div class="col-md-6 mb-3">
              <label for="newChildAge" class="form-label">Alter <span class="text-danger">*</span></label>
              <input
                  type="number"
                  id="newChildAge"
                  class="form-control"
                  v-model.number="newChildAge"
                  placeholder="Alter des Kindes"
                  min="0"
                  required
              >
            </div>
            <div class="col-md-6 mb-3">
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
              <div class="form-text">0=Nichtschwimmer, 1=Seepferdchen, 4=Gold</div>
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
              <font-awesome-icon :icon="['fas', editingChildIndex !== null ? 'save' : 'add']" />
              {{ editingChildIndex !== null ? 'Speichern' : 'Kind hinzufügen' }}
            </button>
            <button v-if="editingChildIndex !== null" type="button" class="btn btn-outline-secondary btn-lg" @click="cancelEdit">
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
// --- Синтетические данные для эмуляции API ---
const SYNTHETIC_GROUP_DATA = {
  // Имитация данных, которые будут получены из 'groupBin'
  Kinder: [
    // Gruppe 1
    { name: "Max Mühler", age: 12, schwimmer: 1, notes: "hat eine Allergie auf Dust", group_id: 1, band_id: null },
    { name: "Emily Schulz", age: 10, schwimmer: 2, notes: "", group_id: 1, band_id: null },
    { name: "Sofia Wagner", age: 8, schwimmer: 0, notes: "Braucht Schwimmweste", group_id: 1, band_id: null },
    { name: "Lukas Becker", age: 13, schwimmer: 4, notes: "", group_id: 1, band_id: null },
    { name: "Mia Schmidt", age: 9, schwimmer: 3, notes: "Vegetarisch", group_id: 1, band_id: null },

    // Gruppe 2
    { name: "Jonas Richter", age: 11, schwimmer: 3, notes: "", group_id: 2, band_id: null },
    { name: "Anna Klein", age: 14, schwimmer: 4, notes: "Asthma-Spray dabei", group_id: 2, band_id: null },
    { name: "Ben Weber", age: 7, schwimmer: 0, notes: "", group_id: 2, band_id: null },
    { name: "Lena Huber", age: 10, schwimmer: 1, notes: "Laktoseintoleranz", group_id: 2, band_id: null },
    { name: "Felix König", age: 12, schwimmer: 2, notes: "", group_id: 2, band_id: null },

    // Gruppe 3
    { name: "Sarah Graf", age: 9, schwimmer: 2, notes: "", group_id: 3, band_id: null },
    { name: "Tim Müller", age: 15, schwimmer: 4, notes: "", group_id: 3, band_id: null },
    { name: "Elena Wolf", age: 8, schwimmer: 0, notes: "Ängstlich im Wasser", group_id: 3, band_id: null },
    { name: "Moritz Koch", age: 11, schwimmer: 3, notes: "Muss täglich Medikamente nehmen", group_id: 3, band_id: null },
    { name: "Hannah Bauer", age: 13, schwimmer: 1, notes: "", group_id: 3, band_id: null },
  ]
};



const Utils = {
  // Mapping für Schwimmabzeichen
  SWIM_LEVELS: {
    0: 'Nichtschwimmer',
    1: 'Seepferdchen',
    2: 'Bronze',
    3: 'Silber',
    4: 'Gold',
  },
  SWIM_BADGE_CLASSES: {
    0: 'bg-danger text-white',
    1: 'bg-warning text-dark',
    2: 'bg-info text-white',
    3: 'bg-secondary text-white',
    4: 'bg-success text-white',
  },

  getSwimLevel(level) {
    // Greift direkt auf Utils.SWIM_LEVELS zu
    return Utils.SWIM_LEVELS[level] || 'Unbekannt';
  },
  getSwimBadgeClass(level) {
    // ! DIES IST DIE FEHLERHAFTE STELLE !
    // Zuvor: return this.SWIM_BADGE_CLASSES[level] || 'bg-light text-dark';
    // Korrekt: Greift direkt auf Utils.SWIM_BADGE_CLASSES zu
    return Utils.SWIM_BADGE_CLASSES[level] || 'bg-light text-dark';
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

    // В реальном Vue приложении лучше использовать компонент для Alert
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
      // Требуется импорт Bootstrap JS для работы .close()
      // Для этой демонстрации просто удалим
      alertDiv.remove();
    }, 5000);
  },
};

export default {
  name: 'GroupEditView',
  data() {
    return {
      // Имитация данных о состоянии
      isConfigLoaded: true, // Имитация успешной загрузки конфигурации
      loadingInitialData: true,
      // get group_number from URL: this.$route.query.gr || '1'
      groupNumber: this.$route.query ? this.$route.query.gr || '1' : '1', // Gruppe von URL oder Standard '1'

      // Данные компонента для формы
      newChildName: '',
      newChildAge: '',
      newChildSchwimm: 0, // Standardwert auf Nichtschwimmer setzen
      newChildNotes: '',
      editingChildIndex: null, // Index des zu bearbeitenden Kindes. null für Hinzufügen.

      formattedCurrentDate: '',
      currentGroupData: {}, // Hier werden die gefilterten Kinderdaten der aktuellen Gruppe gespeichert

      // Эмулируемый API
      syntheticApiDelay: 500, // Задержка для эмуляции сетевого запроса
    };
  },
  computed: {
    children() {
      // Die Kinder der aktuellen Gruppe filtern
      const groupID = parseInt(this.groupNumber);
      return (this.currentGroupData.Kinder || []).filter(child => child.group_id === groupID);
    }
  },
  async created() {
    this.formattedCurrentDate = Utils.formatDateForDisplay(Utils.getCurrentDateString());

    // Sicherstellen, dass groupNumber eine Zeichenkette ist (von URL-Query) und gefiltert wird.
    this.groupNumber = String(this.groupNumber);

    // Эмуляция загрузки данных
    await this.loadInitialData();
  },
  methods: {
    getSwimLevel: Utils.getSwimLevel,
    getSwimBadgeClass: Utils.getSwimBadgeClass,

    // --- Эмуляция API-методов ---
    async loadInitialData() {
      this.loadingInitialData = true;
      // Эмуляция задержки сети
      await new Promise(resolve => setTimeout(resolve, this.syntheticApiDelay));

      try {
        // 1. Имитация получения всех данных
        // Wir klonen die gesamten synthetischen Daten
        this.currentGroupData = { Kinder: [...SYNTHETIC_GROUP_DATA.Kinder] };

        // 2. Имитация проверки массива Kinder
        if (!this.currentGroupData.Kinder) {
          this.currentGroupData.Kinder = [];
        }

        Utils.showAlert(`Synthetische Daten für Gruppe ${this.groupNumber} geladen.`, 'info');

      } catch (error) {
        // В случае реальной ошибки API
        Utils.showAlert('Synthetischer Fehler beim Laden der Daten.', 'danger');
        this.isConfigLoaded = false;
      } finally {
        this.loadingInitialData = false;
      }
    },

    async updateDataInDatabase(data) {
      // Эмуляция обновления данных в базе (API PUT)
      await new Promise(resolve => setTimeout(resolve, this.syntheticApiDelay));
      console.log("SYNTHETIC API: Daten gespeichert:", data);
      // Immer erfolgreich im synthetischen Modus
      return true;
    },

    // --- Методы UI / CRUD-Funktionen ---

    resetForm() {
      this.newChildName = '';
      this.newChildAge = '';
      this.newChildSchwimm = 0;
      this.newChildNotes = '';
      this.editingChildIndex = null;
    },

    cancelEdit() {
      this.resetForm();
      Utils.showAlert('Bearbeitung abgebrochen.', 'info', 'formAlertContainer');
    },

    validateChildData() {
      const name = this.newChildName.trim();
      const age = this.newChildAge;
      const schwimmer = this.newChildSchwimm;

      if (!name) {
        Utils.showAlert('Bitte geben Sie einen Namen für das Kind ein.', 'warning', 'formAlertContainer');
        return false;
      }
      // Prüfen, ob Alter numerisch und ein positives Ganzzahl-ähnlicher Wert ist
      if (!Number.isInteger(Number(age)) || Number(age) <= 0) {
        Utils.showAlert('Bitte geben Sie ein gültiges Alter (positive Zahl) ein.', 'warning', 'formAlertContainer');
        return false;
      }
      // Prüfen, ob Schwimmer-Level im gültigen Bereich (0-4) liegt
      if (!Number.isInteger(Number(schwimmer)) || Number(schwimmer) < 0 || Number(schwimmer) > 4) {
        Utils.showAlert('Bitte wählen Sie ein gültiges Schwimmer-Level (0 bis 4).', 'warning', 'formAlertContainer');
        return false;
      }
      return true;
    },

    async saveChild() {
      if (!this.validateChildData()) {
        return;
      }

      const newChildData = {
        name: this.newChildName.trim(),
        age: parseInt(this.newChildAge),
        schwimmer: parseInt(this.newChildSchwimm),
        notes: this.newChildNotes.trim(),
        group_id: parseInt(this.groupNumber),
        band_id: null // Wird von der Datenbank gesetzt
      };

      const groupID = parseInt(this.groupNumber);
      // Finde den globalen Index des Kindes in currentGroupData.Kinder

      if (this.editingChildIndex !== null) {
        // BEARBEITEN
        const globalIndex = this.currentGroupData.Kinder.findIndex(
            (child, idx) => child.group_id === groupID && idx === this.editingChildIndex
        );

        if (globalIndex !== -1) {
          // Temporäres Backup
          const oldChildData = { ...this.currentGroupData.Kinder[globalIndex] };

          // Lokales Update
          this.currentGroupData.Kinder[globalIndex] = newChildData;

          try {
            const success = await this.updateDataInDatabase(this.currentGroupData);

            if (success) {
              Utils.showAlert(`Kind "${newChildData.name}" erfolgreich bearbeitet! (Synthetisches Speichern)`, 'success');
              this.resetForm();
            } else {
              // Rollback
              this.currentGroupData.Kinder[globalIndex] = oldChildData;
              Utils.showAlert('Fehler beim Speichern der Kindesdaten.', 'danger');
            }
          } catch (error) {
            this.currentGroupData.Kinder[globalIndex] = oldChildData; // Rollback
            Utils.showAlert(`Fehler beim Speichern des Kindes: ${error.message}`, 'danger');
          }
        }
      } else {
        // HINZUFÜGEN
        try {
          // Lokales Update (Fügen Sie es zur gesamten Liste hinzu, da es synthetisch ist)
          this.currentGroupData.Kinder.push(newChildData);

          // Echte Logik: Wir suchen den Index des neuen Kindes
          // In diesem synthetischen Setup wird das Kind automatisch gefiltert und in der computed children Property angezeigt

          const success = await this.updateDataInDatabase(this.currentGroupData);

          if (success) {
            Utils.showAlert(`Kind "${newChildData.name}" erfolgreich hinzugefügt! (Synthetisches Speichern)`, 'success');
            this.resetForm();
          } else {
            // Rollback, wenn Speichern fehlschlägt
            this.currentGroupData.Kinder.pop();
            Utils.showAlert('Fehler beim Hinzufügen des Kindes.', 'danger');
          }
        } catch (error) {
          Utils.showAlert(`Fehler beim Speichern des Kindes: ${error.message}`, 'danger');
        }
      }
    },

    async editChild(localIndex) {
      // localIndex ist der Index in der gefilterten 'children' Liste
      this.editingChildIndex = localIndex;
      const childToEdit = this.children[localIndex];

      // Formular füllen
      this.newChildName = childToEdit.name;
      this.newChildAge = childToEdit.age;
      this.newChildSchwimm = childToEdit.schwimmer;
      this.newChildNotes = childToEdit.notes;

      // Fokus auf das Formular
      document.getElementById('newChildName').focus();
      Utils.showAlert(`Kind "${childToEdit.name}" zum Bearbeiten geladen.`, 'info', 'formAlertContainer');
    },

    async removeChild(localIndex) {
      const childToRemove = this.children[localIndex];

      if (confirm(`Möchten Sie das Kind "${childToRemove.name}" wirklich entfernen?`)) {
        // Finde den globalen Index in currentGroupData.Kinder
        const groupID = parseInt(this.groupNumber);
        const globalIndex = this.currentGroupData.Kinder.findIndex(
            (child, idx) => child.group_id === groupID && idx === localIndex
        );

        if (globalIndex === -1) {
          Utils.showAlert('Fehler: Kind wurde in den globalen Daten nicht gefunden.', 'danger');
          return;
        }

        try {
          // Lokales Entfernen und Speichern des entfernten Elements für den Rollback
          const removedChild = this.currentGroupData.Kinder.splice(globalIndex, 1)[0];

          // Wenn das entfernte Kind dasjenige war, das gerade bearbeitet wird, den Bearbeitungsmodus beenden
          if (this.editingChildIndex === localIndex) {
            this.resetForm();
          }

          // Эмуляция сохранения
          const success = await this.updateDataInDatabase(this.currentGroupData);

          if (success) {
            Utils.showAlert(`Kind "${removedChild.name}" erfolgreich entfernt. (Synthetisches Speichern)`, 'success');
          } else {
            // Rollback, wenn Speichern fehlschlägt
            this.currentGroupData.Kinder.splice(globalIndex, 0, removedChild);
            Utils.showAlert('Fehler beim Entfernen des Kindes.', 'danger');
          }
        } catch (error) {
          Utils.showAlert(`Fehler beim Entfernen des Kindes: ${error.message}`, 'danger');
        }
      }
    },

    goBack() {
      // В реальном приложении Vue: this.$router.push({ name: 'GroupSelection' });
      alert('Zurück-Navigation (Emulation): Rückkehr zur Gruppenauswahl.');
      // window.history.back();
    }
  }
};
</script>

<style>
/* ... (Der Stilblock bleibt unverändert, um die visuelle Konsistenz zu gewährleisten) ... */
/* --- Стили для центрирования и общего вида --- */
.main-container {
  display: flex;
  flex-direction: column; /* Vertikale Anordnung der Karten */
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa; /* Светлый фон */
}

.card {
  width: 100%;
  max-width: 650px; /* Ограничение ширины для лучшей читаемости */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card + .card {
  margin-top: 20px; /* Abstand zwischen den Karten */
}

.card-header {
  background-color: #007bff; /* Основной цвет Bootstrap - синий */
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}

/* --- Стили для списка детей --- */
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

/* Anpassung der Buttons im list-group-item */
.list-group-item .btn {
  /* Stil für alle Buttons in der Liste */
  margin-left: 10px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

/* Spezifische Anpassung für Edit/Delete Buttons, falls notwendig */
.list-group-item .btn-outline-primary {
  color: #007bff;
  border-color: #007bff;
}

.list-group-item .btn-outline-danger {
  color: #dc3545;
  border-color: #dc3545;
}


/* --- Кнопка "Zurück" --- */
.btn-secondary {
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #5a6268;
  border-color: #545b62;
}

/* --- Input Group --- */
.input-group .form-control {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.input-group .btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
</style>