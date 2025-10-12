<template>
  <div class="min-vh-100 bg-light">
    <!-- Navigation Bar -->
    <nav v-if="isAuthenticated" class="navbar navbar-expand-lg navbar-light bg-success shadow-sm">
      <div class="container-fluid px-3">
        <span class="navbar-brand text-white fw-bold mb-0">🌳 Stadtranderholung</span>
        
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

    <!-- Main Content -->
    <main class="container-fluid p-3">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from './supabase'

const router = useRouter()
const route = useRoute()

const isAuthenticated = ref(false)
const isAdmin = ref(false)
const userEmail = ref('')

// Check authentication on mount
onMounted(async () => {
  await checkAuth()
})

// Watch for route changes
watch(() => route.path, async () => {
  await checkAuth()
})

// Check authentication status
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      isAuthenticated.value = true
      userEmail.value = session.user.email

      // Get role from users table
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      isAdmin.value = userData?.role === 'admin'
    } else {
      isAuthenticated.value = false
      isAdmin.value = false
      userEmail.value = ''
    }
  } catch (err) {
    console.error('Fehler bei der Berechtigungsprüfung:', err)
  }
}

// Logout function
async function logout() {
  try {
    // Remove stored credentials
    localStorage.removeItem('auth_credentials')

    // Sign out from Supabase Auth
    await supabase.auth.signOut()

    console.log('👋 Erfolgreich abgemeldet')

    // Redirect to login page
    await router.push('/login')
  } catch (err) {
    console.error('Fehler beim Abmelden:', err)
  }
}
</script>

<style scoped>
/* Bootstrap navbar toggler color fix for light theme */
.navbar-toggler {
  filter: brightness(0) invert(1);
}

.nav-link {
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 0.8;
}
</style>
