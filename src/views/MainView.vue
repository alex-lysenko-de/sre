<template>
  <div class="main-view-container">
    <div class="card shadow-lg">
      <div class="card-header text-center">
        <h2 class="mb-0">
          <font-awesome-icon :icon="['fas', 'home']" class="me-2" />
          Willkommen
        </h2>
        <p v-if="isAuthenticated" class="mb-0 mt-2 text-white-50">
          {{ userEmail }}
        </p>
      </div>

      <div class="card-body p-4">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Lädt...</span>
          </div>
          <p class="text-muted">Lade Benutzerdaten...</p>
        </div>

        <!-- Main Menu -->
        <div v-else class="d-grid gap-3">

          <!-- User's Group Button -->
          <button
              v-if="isAuthenticated && userStore.userInfo.group_id"
              @click="goToMyGroup"
              class="btn btn-primary btn-lg d-flex align-items-center justify-content-between"
          >
            <span class="d-flex align-items-center">
              <font-awesome-icon :icon="['fas', 'users']" class="me-3" size="2x" />
              <span>
                <div class="fw-bold text-start">Zu meiner Gruppe</div>
                <small class="text-white-50">Gruppe {{ userStore.userInfo.group_id }}</small>
              </span>
            </span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>

          <!-- Admin Overview Button -->
          <button
              v-if="userStore.isAdmin"
              @click="goToAdminBus"
              class="btn btn-warning btn-lg d-flex align-items-center justify-content-between"
          >
            <span class="d-flex align-items-center">
              <font-awesome-icon :icon="['fas', 'bus']" class="me-3" size="2x" />
              <span>
                <div class="fw-bold text-start">Busse</div>
                <small class="opacity-75">Alle Busse verwalten</small>
              </span>
            </span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>


          <!-- Admin Overview Button -->
          <button
              v-if="userStore.isAdmin"
              @click="goToAdminOverview"
              class="btn btn-warning btn-lg d-flex align-items-center justify-content-between"
          >
            <span class="d-flex align-items-center">
              <font-awesome-icon :icon="['fas', 'chart-line']" class="me-3" size="2x" />
              <span>
                <div class="fw-bold text-start">Admin Übersicht</div>
                <small class="opacity-75">Alle Gruppen verwalten</small>
              </span>
            </span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>

          <!-- Scan Button (for authenticated users) -->
          <button
              v-if="isAuthenticated"
              @click="goToScan"
              class="btn btn-success btn-lg d-flex align-items-center justify-content-between"
          >
            <span class="d-flex align-items-center">
              <font-awesome-icon :icon="['fas', 'qrcode']" class="me-3" size="2x" />
              <span>
                <div class="fw-bold text-start">Scannen</div>
                <small class="text-white-50">Kinder im Bus zählen</small>
              </span>
            </span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>

          <!-- Login Button (for guests) -->
          <button
              v-if="!isAuthenticated"
              @click="goToLogin"
              class="btn btn-primary btn-lg d-flex align-items-center justify-content-between"
          >
            <span class="d-flex align-items-center">
              <font-awesome-icon :icon="['fas', 'sign-in-alt']" class="me-3" size="2x" />
              <span>
                <div class="fw-bold text-start">Anmelden</div>
                <small class="text-white-50">Zugang für Betreuer</small>
              </span>
            </span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>

          <!-- Info Button (always visible) -->
          <button
              v-if="!isAuthenticated"
              @click="goToInfo"
              class="btn btn-outline-secondary btn-lg d-flex align-items-center justify-content-between"
          >
            <span class="d-flex align-items-center">
              <font-awesome-icon :icon="['fas', 'info-circle']" class="me-3" size="2x" />
              <span>
                <div class="fw-bold text-start">Informationen</div>
                <small class="opacity-75">Für Gäste</small>
              </span>
            </span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" />
          </button>

        </div>

        <!-- No Group Warning -->
        <div
            v-if="isAuthenticated && !userStore.userInfo.group_id && !userStore.isAdmin"
            class="alert alert-warning mt-4"
        >
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
          <strong>Keine Gruppe zugewiesen</strong>
          <p class="mb-0 mt-2 small">
            Sie sind derzeit keiner Gruppe zugeordnet. Bitte wenden Sie sich an einen Administrator.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { supabase } from '@/supabase'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const isAuthenticated = ref(false)

const userEmail = computed(() => userStore.userEmail)

/**
 * Check authentication status
 */
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    isAuthenticated.value = !!session

    if (session && !userStore.userInfo.user_id) {
      await userStore.loadUser()
    }
  } catch (err) {
    console.error('Error checking auth:', err)
    isAuthenticated.value = false
  } finally {
    loading.value = false
  }
}

/**
 * Navigation methods
 */
function goToMyGroup() {
  router.push(`/group-edit`)
}

function goToAdminBus() {
  router.push('/admin-busses')
}

function goToAdminOverview() {
  router.push('/children')
}

function goToScan() {
  router.push('/scanner')
}

function goToLogin() {
  router.push('/login')
}

function goToInfo() {
  router.push('/info')
}

/**
 * Initialize on mount
 */
onMounted(async () => {
  await checkAuth()
})
</script>

<style scoped>
.main-view-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.card {
  width: 100%;
  max-width: 600px;
  border-radius: 20px;
  border: none;
  overflow: hidden;
}

.card-header {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 2rem;
  border: none;
}

.card-header h2 {
  font-size: 1.75rem;
  font-weight: 600;
}

.card-body {
  background: white;
}

.btn-lg {
  padding: 1.25rem 1.5rem;
  font-size: 1.1rem;
  border-radius: 12px;
  transition: all 0.3s ease;
  text-align: left;
  min-height: 80px;
}

.btn-lg:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.btn-lg:active {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
}

.btn-warning {
  background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
  border: none;
  color: #212529;
}

.btn-warning:hover {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: #212529;
}

.btn-success {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  border: none;
}

.btn-success:hover {
  background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%);
}

.btn-outline-secondary {
  border: 2px solid #6c757d;
  color: #6c757d;
  background: transparent;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.alert-warning {
  border-radius: 12px;
  border-left: 4px solid #ffc107;
}

@media (max-width: 576px) {
  .main-view-container {
    padding: 10px;
    min-height: 70vh;
  }

  .card-header h2 {
    font-size: 1.4rem;
  }

  .btn-lg {
    padding: 1rem 1.25rem;
    font-size: 1rem;
    min-height: 70px;
  }

  .btn-lg svg {
    font-size: 1.5rem !important;
  }
}
</style>