<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header bg-primary text-white">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'key']" />
          Passwort zurücksetzen
        </h3>
      </div>
      <div class="card-body">
        <div id="alertContainer"></div>

        <form @submit.prevent="resetPassword" class="p-3">
          <p class="text-muted">Geben Sie Ihr neues Passwort ein.</p>

          <div class="mb-3">
            <label for="newPassword" class="form-label">Neues Passwort <span class="text-danger">*</span></label>
            <input
                type="password"
                id="newPassword"
                class="form-control"
                v-model="newPassword"
                required
                minlength="6"
                placeholder="Mindestens 6 Zeichen"
            >
          </div>

          <div class="mb-3">
            <label for="confirmPassword" class="form-label">Passwort bestätigen <span class="text-danger">*</span></label>
            <input
                type="password"
                id="confirmPassword"
                class="form-control"
                v-model="confirmPassword"
                required
                minlength="6"
            >
          </div>

          <button type="submit" class="btn btn-success w-100 mt-3" :disabled="isResetting">
            <font-awesome-icon :icon="['fas', 'check']" class="me-1" />
            Passwort bestätigen und setzen
          </button>
        </form>

        <div class="text-center mt-4">
          <router-link to="/login" class="btn btn-link">Zurück zum Login</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '@/supabase';

// --- Utility for styles and notifications (Reused from UsersView.vue) ---
const Utils = {
  showAlert(message, type = 'info', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;

    alertContainer.innerHTML = '';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => { alertDiv.remove(); }, 5000);
  },
};

export default {
  name: 'ResetPasswordView',
  data() {
    return {
      newPassword: '',
      confirmPassword: '',
      isResetting: false,
    };
  },
  methods: {
    showAlert: Utils.showAlert,

    /**
     * English: Handles the password reset process. It checks for password matching
     * and uses Supabase to update the password for the current session (set by the URL token).
     * German: Verwaltet den Passwort-Reset-Prozess. Überprüft die Passwörter und
     * aktualisiert das Passwort für die aktuelle Sitzung.
     * @async
     * @returns {void}
     */
    async resetPassword() {
      if (this.newPassword !== this.confirmPassword) {
        this.showAlert('Die Passwörter stimmen nicht überein.', 'warning');
        return;
      }
      if (this.newPassword.length < 6) {
        this.showAlert('Das Passwort muss mindestens 6 Zeichen lang sein.', 'warning');
        return;
      }

      this.isResetting = true;

      try {
        // English: The Supabase client automatically picks up the 'access_token' from the URL
        // and treats the subsequent password update as a password reset action.
        const { error } = await supabase.auth.updateUser({
          password: this.newPassword,
        });

        if (error) {
          this.showAlert(`Fehler beim Zurücksetzen des Passworts: ${error.message}`, 'danger');
        } else {
          this.showAlert('Ihr Passwort wurde erfolgreich zurückgesetzt! Sie werden zum Login weitergeleitet.', 'success');

          // English: Redirect to login after a brief pause
          setTimeout(() => {
            this.$router.push('/login');
          }, 3000);
        }
      } catch (error) {
        this.showAlert(`Ein unerwarteter Fehler ist aufgetreten: ${error.message}`, 'danger');
      } finally {
        this.isResetting = false;
      }
    },
  },
};
</script>

<style scoped>
/* English: Adopted styles for layout and card appearance */
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
  max-width: 450px; /* Smaller max-width for a cleaner form */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card-header {
  background-color: #0d6efd !important; /* bg-primary */
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}
</style>