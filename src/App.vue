<template>
  <div class="min-vh-100 bg-light">
    <!-- Daily Check-In Modal (Blocking) -->
    <DailyCheckInModal
        :show="showCheckInModal"
        @completed="onCheckInCompleted"
        @error="onCheckInError"
    />

    <!-- Navigation Bar -->
    <nav v-if="isAuthenticated" class="navbar navbar-expand-lg navbar-light bg-success shadow-sm">
      <div class="container-fluid px-3">
        <span class="navbar-brand text-white fw-bold mb-0">🌳 Stadtranderholung</span>

        <!-- User Info Indicators (Group & Bus) -->
        <div v-if="userInfo.isPresentToday" class="d-none d-lg-flex align-items-center gap-3 me-3">
          <button
              @click="showGroupChangeModal = true"
              class="btn btn-sm btn-light d-flex align-items-center gap-2"
              title="Gruppe ändern"
          >
            <font-awesome-icon :icon="['fas', 'users']"/>
            <span>Gruppe {{ userInfo.group_id || '?' }}</span>
          </button>

          <button
              @click="showBusChangeModal = true"
              class="btn btn-sm btn-light d-flex align-items-center gap-2"
              title="Bus ändern"
          >
            <font-awesome-icon :icon="['fas', 'bus']"/>
            <span>Bus {{ userInfo.bus_id || '?' }}</span>
          </button>
        </div>

        <button
            class="navbar-toggler border-white"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Navigation umschalten"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <router-link to="/info" class="nav-link text-white">
                ℹ️ Info
              </router-link>
            </li>
            <li class="nav-item">
              <router-link to="/children" class="nav-link text-white">
                🧒 Kinder
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/config" class="nav-link text-white">
                ⚙️ Konfiguration
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/users-edit" class="nav-link text-white">
                👥 Benutzer
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/invite" class="nav-link text-white">
                🎟️ Einladungen
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/days-edit" class="nav-link text-white">
                🗓️ Tage bearbeiten
              </router-link>
            </li>
            <li class="nav-item">
              <router-link to="/main/scan" class="nav-link text-white">
                📷 Scannen
              </router-link>
            </li>
          </ul>

          <!-- Mobile Group/Bus Indicators -->
          <div v-if="userInfo.isPresentToday" class="d-lg-none mb-2">
            <button
                @click="showGroupChangeModal = true"
                class="btn btn-sm btn-light me-2"
            >
              👥 Gruppe {{ userInfo.group_id || '?' }}
            </button>
            <button
                @click="showBusChangeModal = true"
                class="btn btn-sm btn-light"
            >
              🚌 Bus {{ userInfo.bus_id || '?' }}
            </button>
          </div>

          <div class="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
            <span class="text-white small">
              👤 {{ userEmail }}
              <span v-if="isAdmin" class="badge bg-dark ms-2">ADMIN</span>
            </span>
            <button
                @click="logout"
                class="btn btn-danger btn-sm"
            >
              🚪 Abmelden
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Group Change Modal -->
    <GroupChangeModal
        v-if="showGroupChangeModal"
        :show="showGroupChangeModal"
        :current-group="userInfo.group_id"
        @close="showGroupChangeModal = false"
        @saved="onGroupChanged"
    />

    <!-- Bus Change Modal -->
    <BusChangeModal
        v-if="showBusChangeModal"
        :show="showBusChangeModal"
        :current-bus="userInfo.bus_id"
        @close="showBusChangeModal = false"
        @saved="onBusChanged"
    />

    <!-- Main Content -->
    <main class="container-fluid p-3">
      <router-view/>
    </main>
  </div>
</template>

<script setup>
import {ref, computed, onMounted, watch} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import {supabase} from './supabase'
import {useUser} from './composables/useUser'
import DailyCheckInModal from './views/DailyCheckInModalView.vue'
import GroupChangeModal from './components/GroupChangeModal.vue'
import BusChangeModal from './components/BusChangeModal.vue'

const router = useRouter()
const route = useRoute()

// User composable
const {
  userInfo,
  isAdmin,
  isCheckInRequired,
  loadUser,
  clearUserCache
} = useUser()

// Local state
const isAuthenticated = ref(false)
const userEmail = ref('')
const showGroupChangeModal = ref(false)
const showBusChangeModal = ref(false)

// Computed
const showCheckInModal = computed(() =>
    isAuthenticated.value && isCheckInRequired.value
)

// Initialize app
onMounted(async () => {
  await initializeApp()
})

// Watch for route changes
watch(() => route.path, async () => {
  await checkAuth()
})


/**
 * Initialize application
 * Checks for existing session or attempts auto-login
 */
async function initializeApp() {
  const isRegistered = localStorage.getItem('sre_user_registered') === 'true';

  // Für Gäste wird der Authentifizierungsprozess übersprungen
  if (!isRegistered) {
    console.log('👤 Gastmodus. Authentifizierung wird übersprungen.');
    isAuthenticated.value = false;
    return; // Wichtig: Hier abbrechen
  }


  // Für registrierte Nutzer wird der normale Authentifizierungsprozess gestartet
  console.log('✅ Registrierter Benutzer. Starte Authentifizierung...');


  // Check for existing session
  try {
    const { data : { session } } = await supabase.auth.getSession();

    if (session) {
      await handleAuthentication(session);
    } else {
      // Try auto-login from localStorage
      await attemptAutoLogin();
    }
  } catch (err) {
    console.error('Fehler bei der Initialisierung:', err);
    isAuthenticated.value = false;
    // Wenn etwas schiefgeht, zum Login leiten
    if (route.path !== '/login' && route.path !== '/welcome') {
      await router.push('/login');
    }
  }
}

/**
 * Attempt automatic login using stored credentials
 */
async function attemptAutoLogin() {
  try {
    const savedCredentials = getSavedCredentials()

    if (!savedCredentials) {
      // No saved credentials, redirect to login
      if (route.path !== '/login' && route.path !== '/welcome') {
        await router.push('/login')
      }
      return
    }

    console.log('🔑 Gespeicherte Anmeldedaten gefunden, führe automatische Anmeldung durch...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email : savedCredentials.email,
      password : savedCredentials.password
    })

    if (error) throw error

    await handleAuthentication(data.session)
    console.log('✅ Automatische Anmeldung erfolgreich')

  } catch (err) {
    console.error('Fehler bei der automatischen Anmeldung:', err)
    clearSavedCredentials()

    if (route.path !== '/login' && route.path !== '/welcome') {
      await router.push('/login')
    }
  }
}

/**
 * Handle successful authentication
 */
async function handleAuthentication(session) {
  isAuthenticated.value = true
  userEmail.value = session.user.email

  // Load user data with useUser composable
  await loadUser()

  // Check if user needs to check in
  if (isCheckInRequired.value) {
    console.log('⚠️ Ежедневная регистрация требуется')
  }
}

/**
 * Check current authentication status
 */
async function checkAuth() {
  try {
    const { data : { session } } = await supabase.auth.getSession()

    if (session) {
      isAuthenticated.value = true
      userEmail.value = session.user.email
      await loadUser()
    } else {
      isAuthenticated.value = false
      userEmail.value = ''
    }
  } catch (err) {
    console.error('Fehler bei der Berechtigungsprüfung:', err)
  }
}

/**
 * Get saved credentials from localStorage
 */
function getSavedCredentials() {
  const saved = localStorage.getItem('auth_credentials')
  if (!saved) return null

  try {
    return JSON.parse(atob(saved))
  } catch {
    return null
  }
}

/**
 * Clear saved credentials
 */
function clearSavedCredentials() {
  localStorage.removeItem('auth_credentials')
}

/**
 * Handle check-in completion
 */
function onCheckInCompleted(data) {
  console.log('✅ Ежедневная регистрация завершена:', data)
  // Modal will close automatically via isCheckInRequired becoming false
}

/**
 * Handle check-in error
 */
function onCheckInError(error) {
  console.error('❌ Ошибка при регистрации:', error)
}

/**
 * Handle group change
 */
async function onGroupChanged(newGroupId) {
  console.log(`✅ Gruppe geändert auf: ${newGroupId}`)
  showGroupChangeModal.value = false
  await loadUser(true) // Force reload
}

/**
 * Handle bus change
 */
async function onBusChanged(newBusId) {
  console.log(`✅ Bus geändert auf: ${newBusId}`)
  showBusChangeModal.value = false
  await loadUser(true) // Force reload
}

/**
 * Logout function
 */
async function logout() {
  try {
    // Clear stored credentials
    clearSavedCredentials()

    // Clear user cache
    clearUserCache()

    // Sign out from Supabase
    await supabase.auth.signOut()

    console.log('👋 Erfolgreich abgemeldet')

    // Redirect to login
    await router.push('/login')
  } catch (err) {
    console.error('Fehler beim Abmelden:', err)
  }
}
</script>

<style scoped>
.navbar-toggler {
  filter: brightness(0) invert(1);
}

.nav-link {
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 0.8;
}

.btn-sm {
  font-size: 0.875rem;
  padding: 0.25rem 0.75rem;
}

@media (max-width: 992px) {
  .navbar-brand {
    font-size: 1rem;
  }
}
</style>