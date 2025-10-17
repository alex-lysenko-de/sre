<template>
  <div class="min-vh-100 bg-light">
    <!-- Daily Check-In Modal (Blocking) -->
    <DailyCheckInModal
        :show="showCheckInModal"
        @completed="onCheckInCompleted"
        @error="onCheckInError"
        @close="showCheckInModal = false"
    />

    <!-- Navigation Bar -->
    <nav v-if="isAuthenticated" class="navbar navbar-expand-lg navbar-light bg-success shadow-sm">
      <div class="container-fluid px-1">

        <div v-if="isCheckInRequired" class="ms-auto me-2">
          <button class="btn btn-warning fw-bold" @click="showCheckInModal = true">
            Ich fahre heute mit!
          </button>
        </div>

        <!-- Logo/Brand - Links to Main -->
        <router-link to="/main" class="navbar-brand text-white fw-bold mb-0 text-decoration-none btn btn-success shadow">
          🌳 SRE
        </router-link>

        <!-- User Info Indicators (Group & Bus) -->
        <div v-if="!isCheckInRequired && userStore.userInfo.isPresentToday" class="d-flex align-items-center gap-2 me-1">
          <button
              @click="showGroupChangeModal = true"
              class="btn btn-sm btn-light d-flex align-items-center gap-2"
              title="Gruppe ändern"
          >
            <font-awesome-icon :icon="['fas', 'users']"/>
            <span>Gruppe {{ userStore.userInfo.group_id || '?' }}</span>
          </button>

          <button
              @click="showBusChangeModal = true"
              class="btn btn-sm btn-light d-flex align-items-center gap-2"
              title="Bus ändern"
          >
            <font-awesome-icon :icon="['fas', 'bus']"/>
            <span>Bus {{ userStore.userInfo.bus_id || '?' }}</span>
          </button>
        </div>

        <button
            ref="navbarToggler"
            class="navbar-toggler border-white"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Navigation umschalten"
            @click="onTogglerClick"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav" ref="navbarCollapse">
          <ul class="navbar-nav me-auto">

            <li v-if="isAdmin" class="nav-item">
              <router-link to="/children" class="nav-link text-white" @click="closeMenu">
                🧒 Kinder
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/invite" class="nav-link text-white" @click="closeMenu">
                🎟️ Einladungen
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/users-edit" class="nav-link text-white" @click="closeMenu">
                👥 Benutzer
              </router-link>
            </li>

            <li v-if="isAdmin" class="nav-item">
              <router-link to="/days-edit" class="nav-link text-white" @click="closeMenu">
                🗓️ Tage bearbeiten
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/config" class="nav-link text-white" @click="closeMenu">
                ⚙️ Konfiguration
              </router-link>
            </li>
            <li class="nav-item">
              <router-link to="/info" class="nav-link text-white" @click="closeMenu">
                ℹ️ Info
              </router-link>
            </li>
          </ul>

          <!-- Mobile Group/Bus Indicators -->
          <div class="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
            <span class="text-white small">
              👤 {{ userEmail }}
             <span v-if="isAdmin" class="badge bg-dark ms-2">ADMIN</span>
            </span>
            <button
                @click="logout"
                class="btn btn-secondary btn-sm"
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
        :current-group="userStore.userInfo.group_id"
        @close="showGroupChangeModal = false"
        @saved="onGroupChanged"
    />

    <!-- Bus Change Modal -->
    <BusChangeModal
        v-if="showBusChangeModal"
        :show="showBusChangeModal"
        :current-bus="userStore.userInfo.bus_id"
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
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from './supabase'
import { useUserStore } from './stores/user'
import DailyCheckInModal from './views/DailyCheckInModalView.vue'
import GroupChangeModal from './components/GroupChangeModal.vue'
import BusChangeModal from './components/BusChangeModal.vue'

const router = useRouter()
const route = useRoute()

// Use Pinia store
const userStore = useUserStore()

// Computed properties from store
const isAdmin = computed(() => userStore.isAdmin)
const isCheckInRequired = computed(() => userStore.isCheckInRequired)
const userEmail = computed(() => userStore.userEmail)

// Local state
const isAuthenticated = ref(false)
const showGroupChangeModal = ref(false)
const showBusChangeModal = ref(false)
const showCheckInModal = ref(false)

// Refs for menu control
const navbarCollapse = ref(null)
const navbarToggler = ref(null)
let menuTimeout = null

// Initialize app
onMounted(async () => {
  await initializeApp()
})

// Cleanup on unmount
onUnmounted(() => {
  clearMenuTimeout()
})

// Watch for route changes - close menu on navigation
watch(() => route.path, async () => {
  closeMenu()
  await checkAuth()
})

/**
 * Handle navbar toggler click - start auto-close timer
 */
function onTogglerClick() {
  clearMenuTimeout()

  // Start 5-second timer when menu is opened
  menuTimeout = setTimeout(() => {
    closeMenu()
  }, 10000)
}

/**
 * Close mobile menu
 */
function closeMenu() {
  clearMenuTimeout()

  if (navbarCollapse.value && navbarToggler.value) {
    // Check if menu is expanded (mobile view)
    const bsCollapse = window.bootstrap?.Collapse?.getInstance(navbarCollapse.value)

    if (bsCollapse) {
      bsCollapse.hide()
    } else {
      // Fallback: remove Bootstrap classes manually
      navbarCollapse.value.classList.remove('show')
      navbarToggler.value.classList.add('collapsed')
      navbarToggler.value.setAttribute('aria-expanded', 'false')
    }
  }
}

/**
 * Clear menu auto-close timeout
 */
function clearMenuTimeout() {
  if (menuTimeout) {
    clearTimeout(menuTimeout)
    menuTimeout = null
  }
}

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
    if (route.path !== '/login' && route.path !== '/welcome' && route.path !== '/main') {
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
      if (route.path !== '/login' && route.path !== '/welcome' && route.path !== '/main') {
        await router.push('/login')
      }
      return
    }

    console.log('🔐 Gespeicherte Anmeldedaten gefunden, führe automatische Anmeldung durch...')

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

    if (route.path !== '/login' && route.path !== '/welcome' && route.path !== '/main') {
      await router.push('/login')
    }
  }
}

/**
 * Handle successful authentication
 */
async function handleAuthentication(session) {
  isAuthenticated.value = true

  // Load user data with Pinia store
  await userStore.loadUser()

  // Check if user needs to check in
  if (isCheckInRequired.value) {
    console.log('⚠️ Tägliche Registrierung erforderlich')
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
      await userStore.loadUser()
    } else {
      isAuthenticated.value = false
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
  console.log('✅ Daily registration completed', data)
  showCheckInModal.value = false
  userStore.loadUser(true) // Force reload user data
}

/**
 * Handle check-in error
 */
function onCheckInError(error) {
  console.error('❌ Fehler bei der Registrierung:', error)
}

/**
 * Handle group change
 */
async function onGroupChanged(newGroupId) {
  console.log(`✅ Gruppe geändert auf: ${newGroupId}`)
  showGroupChangeModal.value = false
  await userStore.loadUser(true) // Force reload
}

/**
 * Handle bus change
 */
async function onBusChanged(newBusId) {
  console.log(`✅ Bus geändert auf: ${newBusId}`)
  showBusChangeModal.value = false
  await userStore.loadUser(true) // Force reload
}

/**
 * Logout function
 */
async function logout() {
  try {
    // Clear stored credentials
    clearSavedCredentials()

    // Clear user cache and reset store
    userStore.clearUserCache()

    if (userStore.userStatusChannel) {
      await supabase.removeChannel(userStore.userStatusChannel)
      userStore.userStatusChannel = null
      console.log('🧹 Realtime subscription entfernt')
    }

    // Sign out from Supabase
    await supabase.auth.signOut()

    console.log('👋 Erfolgreich abgemeldet')

    // Redirect to main page
    await router.push('/main')
  } catch (err) {
    console.error('Fehler beim Abmelden:', err)
  }
}
</script>

<style scoped>
.navbar-toggler {
  filter: brightness(0) invert(1);
}

.disabled-link {
  pointer-events: none;
  opacity: 0.5;
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