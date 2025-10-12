<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header bg-success text-white">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'users']" />
          Benutzerverwaltung
        </h3>
        <p class="mb-0 mt-2">Registrierte Benutzer im System verwalten</p>
      </div>
      <div class="card-body">
        <div id="alertContainer"></div>

        <div v-if="loadingInitialData" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Benutzerdaten...</p>
        </div>

        <div v-else-if="users.length === 0" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" />
          <h5 class="text-muted mt-2">Keine Benutzer im System gefunden.</h5>
          <p class="text-muted">Fügen Sie neue Benutzer über Einladungen hinzu.</p>
        </div>

        <div v-else>
          <div class="d-flex justify-content-end mb-3">
            <router-link to="/invite" class="btn btn-sm btn-outline-primary">
              <font-awesome-icon :icon="['fas', 'user-plus']" class="me-1" />
              Neuen Benutzer einladen
            </router-link>
          </div>

          <div class="table-responsive">
            <table class="table table-striped table-hover align-middle user-table">
              <thead class="table-light">
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">E-Mail</th>
                <th scope="col">Rolle</th>
                <th scope="col">Telefon</th>
                <th scope="col" class="text-center">Aktionen</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="user in users" :key="user.id" :class="{'table-info': user.role === 'admin'}">
                <td>{{ user.id }}</td>
                <td>
                  <strong>{{ user.display_name }}</strong>
                  <span v-if="!user.active" class="badge bg-warning ms-2">INAKTIV</span>
                </td>
                <td>{{ user.email }}</td>
                <td>
                    <span class="badge" :class="user.role === 'admin' ? 'bg-danger' : 'bg-primary'">
                      {{ user.role === 'admin' ? 'Administrator' : 'Benutzer' }}
                    </span>
                </td>
                <td>
                  <a v-if="user.phone" :href="`tel:${user.phone}`">{{ user.phone }}</a>
                  <span v-else>N/A</span>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-content-center">
                    <button
                        class="btn btn-outline-primary btn-sm me-2"
                        title="WhatsApp-Chat mit Benutzer öffnen"
                        @click="openWhatsAppChat(user.phone)"
                    >
                      <font-awesome-icon :icon="['fab', 'whatsapp']" style="color:#25D366; font-size:1.5rem" />

                    </button>


                    <button
                        class="btn btn-outline-primary btn-sm me-2"
                        @click="openEditModal(user)"
                        title="Benutzer bearbeiten"
                    >
                      <font-awesome-icon :icon="['fas', 'edit']" />
                    </button>

                    <button
                        class="btn btn-outline-info btn-sm me-2"
                        @click="sendResetPasswordEmail(user)"
                        title="Passwort-Reset senden"
                    >
                      <font-awesome-icon :icon="['fas', 'envelope']" />
                    </button>

                    <button
                        class="btn btn-outline-danger btn-sm"
                        @click="deleteUser(user)"
                        :disabled="user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1"
                        title="Benutzer löschen"
                    >
                      <font-awesome-icon :icon="['fas', 'trash-alt']" />
                    </button>
                  </div>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="editUserModal" tabindex="-1" aria-labelledby="editUserModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title" id="editUserModalLabel">
              <font-awesome-icon :icon="['fas', 'user']" class="me-1" />
              Benutzer bearbeiten
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Schließen"></button>
          </div>
          <form @submit.prevent="saveUser">
            <div class="modal-body" v-if="editingUser">
              <div id="modalAlertContainer"></div>

              <p class="text-muted small">Bearbeite Benutzer ID (Auth): <strong>{{ editingUser.user_id }}</strong></p>

              <div class="mb-3">
                <label for="displayName" class="form-label">Name <span class="text-danger">*</span></label>
                <input
                    type="text"
                    id="displayName"
                    class="form-control"
                    v-model="editingUser.display_name"
                    required
                >
              </div>

              <div class="mb-3">
                <label for="email" class="form-label">E-Mail</label>
                <input
                    type="email"
                    id="email"
                    class="form-control"
                    :value="editingUser.email"
                    disabled
                    placeholder="E-Mail-Adresse kann hier nicht geändert werden"
                >
              </div>

              <div class="mb-3">
                <label for="phone" class="form-label">Telefonnummer</label>
                <input
                    type="tel"
                    id="phone"
                    class="form-control"
                    v-model="editingUser.phone"
                    placeholder="Optional"
                >
              </div>

              <div class="mb-3">
                <label for="role" class="form-label">Rolle <span class="text-danger">*</span></label>
                <select id="role" class="form-select" v-model="editingUser.role" required>
                  <option value="user">Benutzer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div class="form-check form-switch mt-4">
                <input
                    class="form-check-input"
                    type="checkbox"
                    id="userActiveSwitch"
                    v-model="editingUser.active"
                    :true-value="true"
                    :false-value="false"
                >
                <label class="form-check-label" for="userActiveSwitch">Konto {{ editingUser.active ? 'Aktiv' : 'Deaktiviert' }}</label>
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving">
                <font-awesome-icon :icon="['fas', 'save']" class="me-1" />
                Speichern
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// English: Import Supabase client and Bootstrap Modal module.
import { supabase } from '@/supabase';
import { Modal } from 'bootstrap';

// --- Utilities for styles and notifications (Adopted from DaysEditView.vue) ---
const Utils = {
  /**
   * English: Displays a temporary Bootstrap alert message.
   * German: Zeigt eine temporäre Bootstrap-Alert-Nachricht an.
   */
  showAlert(message, type = 'info', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;

    // English: Clear previous alerts in the same container
    alertContainer.innerHTML = '';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alertDiv);

    // English: Auto-dismiss after 5 seconds
    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  },
};

export default {
  name: 'UsersView',

  data() {
    return {
      // English: List of all system users (from public.users)
      users: [],
      // English: The user object currently being edited in the modal (deep copy)
      editingUser: null,
      loadingInitialData: true,
      isSaving: false,
      // English: Reference to the Bootstrap Modal instance
      userEditModal: null,
    };
  },

  mounted() {
    // English: Initialize Bootstrap Modal JS object after the DOM is rendered
    const modalElement = document.getElementById('editUserModal');
    if (modalElement) {
      this.userEditModal = new Modal(modalElement);
    }
    // English: Load initial data after mounting
    this.loadInitialData();
  },

  methods: {
    showAlert: Utils.showAlert,

    /**
     * English: Fetches the list of all users from the public.users table.
     * German: Lädt die Liste aller Benutzer aus der Tabelle public.users.
     * @async
     * @returns {void}
     */
    async loadInitialData() {
      this.loadingInitialData = true;

      // English: Select all required columns from public.users, ordering by role (admin first) and name
      const { data, error } = await supabase
          .from('users')
          .select('id, user_id, email, phone, display_name, role, active, last_seen_date')
          .order('role', { ascending: false }) // Admins first
          .order('display_name', { ascending: true });

      if (error) {
        this.showAlert(`Fehler beim Laden der Benutzerdaten: ${error.message}`, 'danger');
        this.users = [];
      } else {
        // English: Ensure active field is a proper boolean and set default to true if null
        this.users = data.map(user => ({
          ...user,
          active: user.active !== null ? user.active : true
        }));
        this.showAlert(`Erfolgreich ${this.users.length} Benutzer von Supabase geladen.`, 'success');
      }

      this.loadingInitialData = false;
    },

    /**
     * English: Prepares user data for editing and opens the modal.
     * German: Bereitet Benutzerdaten zur Bearbeitung vor und öffnet das Modal.
     * @param {Object} user - The user object to edit (deep copy to prevent immediate changes)
     * @returns {void}
     */
    openEditModal(user) {
      // English: Create a deep copy of the user object for editing
      this.editingUser = JSON.parse(JSON.stringify(user));
      // English: Clear previous modal alerts
      const modalAlertContainer = document.getElementById('modalAlertContainer');
      if (modalAlertContainer) modalAlertContainer.innerHTML = '';

      if (this.userEditModal) {
        this.userEditModal.show();
      } else {
        this.showAlert('Fehler: Bearbeitungsformular konnte nicht geöffnet werden.', 'danger');
      }
    },

    /**
     * English: Opens a new window for a WhatsApp chat link.
     * German: Öffnet ein neues Fenster für den WhatsApp-Chat-Link.
     * @param {string} phone - The user's phone number.
     * @returns {void}
     */
    openWhatsAppChat(phone) {
      if (!phone) {
        this.showAlert('Fehler: Keine Telefonnummer für diesen Benutzer verfügbar.', 'warning');
        return;
      }
      // English: Clean the phone number (remove non-digits) and open the link
      const cleanPhone = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    },

    /**
     * English: Saves the changes made to the editingUser object to the database.
     * German: Speichert die Änderungen am editingUser-Objekt in der Datenbank.
     * @async
     * @returns {void}
     */
    async saveUser() {
      if (!this.editingUser || this.isSaving) return;

      this.isSaving = true;

      // English: Prepare data for update (only fields that can be changed)
      const updateData = {
        display_name: this.editingUser.display_name.trim(),
        phone: this.editingUser.phone ? this.editingUser.phone.trim() : null,
        role: this.editingUser.role,
        active: this.editingUser.active,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', this.editingUser.id) // Use public.users.id for update
            .select()
            .single();

        if (error) {
          this.showAlert(`Fehler beim Speichern der Benutzerdaten: ${error.message}`, 'danger', 'modalAlertContainer');
          return;
        }

        // English: Update the local array with the saved data and re-sort
        const index = this.users.findIndex(u => u.id === data.id);
        if (index !== -1) {
          this.users.splice(index, 1, { ...data, active: data.active !== null ? data.active : true });

          this.users.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return a.display_name.localeCompare(b.display_name);
          });
        }

        this.showAlert(`Benutzer "${data.display_name}" erfolgreich gespeichert.`, 'success');
        this.userEditModal.hide();

      } catch (error) {
        this.showAlert(`Unbekannter Fehler beim Speichern: ${error.message}`, 'danger', 'modalAlertContainer');
      } finally {
        this.isSaving = false;
        this.editingUser = null;
      }
    },

    /**
     * English: Deletes a user record (requires confirmation).
     * German: Löscht einen Benutzerdatensatz (bestätigung erforderlich).
     * @async
     * @param {Object} user - The user object to delete.
     * @returns {void}
     */
    async deleteUser(user) {
      if (!confirm(`Sind Sie sicher, dass Sie den Benutzer "${user.display_name}" (E-Mail: ${user.email}) WIRKLICH löschen möchten? Alle zugehörigen Daten werden unwiderruflich gelöscht!`)) {
        return;
      }

      this.loadingInitialData = true; // English: Show loading state

      try {
        // English: Deleting from public.users with user_id foreign key automatically triggers auth.users deletion (CASCADE)
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', user.id); // English: Deletes based on public.users.id

        if (error) {
          this.showAlert(`Fehler beim Löschen des Benutzers: ${error.message}`, 'danger');
          this.loadingInitialData = false;
          return;
        }

        // English: Update local array
        const index = this.users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.users.splice(index, 1);
        }

        this.showAlert(`Benutzer "${user.display_name}" wurde erfolgreich gelöscht.`, 'success');

      } catch (error) {
        this.showAlert(`Unbekannter Fehler beim Löschen: ${error.message}`, 'danger');
      } finally {
        this.loadingInitialData = false;
      }
    },

    /**
     * English: Sends a password reset invitation email using Supabase Auth.
     * German: Sendet eine "Passwort zurücksetzen"-Einladung per E-Mail über Supabase Auth.
     * @async
     * @param {Object} user - The user object containing the email.
     * @returns {void}
     */
    async sendResetPasswordEmail(user) {
      if (!confirm(`Möchten Sie wirklich eine "Passwort zurücksetzen"-Einladung an ${user.email} senden?`)) {
        return;
      }

      try {
        const resetRedirectUrl = `${window.location.origin}/reset-password`;

        // English: Use Supabase Auth method to reset password, specifying the redirect URL
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: resetRedirectUrl
        });

        if (error) {
          this.showAlert(`Fehler beim Senden der Einladung: ${error.message}`, 'danger');
          return;
        }

        this.showAlert(`"Passwort zurücksetzen"-Einladung erfolgreich an ${user.email} gesendet.`, 'success');

      } catch (error) {
        this.showAlert(`Unbekannter Fehler beim Senden des Resets: ${error.message}`, 'danger');
      }
    }
  }
};
</script>

<style scoped>
/* English: Adopted styles for layout and colors */
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
  max-width: 900px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card-header {
  /* English: Use bg-success color from App.vue navigation bar */
  background-color: #198754 !important; /* bg-success */
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}

.user-table {
  font-size: 0.95em;
}

/* English: Highlighting for admin users */
.table-info {
  background-color: #d1e7dd !important; /* Light success color for admin row */
}

/* English: Modal header color to match the primary buttons */
.modal-header.bg-primary {
  background-color: #0d6efd !important; /* Bootstrap primary color */
}

/* English: Fix close button color on dark background */
.modal-header .btn-close-white {
  filter: invert(1) grayscale(100%) brightness(200%);
}
</style>