<template>
  <div class="min-vh-100 bg-light">
    <!-- Sidebar + Top Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-success shadow-sm">
      <div class="container-fluid">
        <router-link to="/main" class="navbar-brand fw-bold">
          🌳 Stadtranderholung
        </router-link>

        <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="mainNav">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <router-link to="/main/scan" class="nav-link text-white">
                📱 Scannen
              </router-link>
            </li>
            <li class="nav-item">
              <router-link to="/main/children" class="nav-link text-white">
                👶 Kinder
              </router-link>
            </li>
            <li v-if="isAdmin" class="nav-item">
              <router-link to="/main/users" class="nav-link text-white">
                👥 Benutzer
              </router-link>
            </li>
            <li class="nav-item">
              <router-link to="/info" class="nav-link text-white">
                ℹ️ Info
              </router-link>
            </li>
          </ul>

          <div class="d-flex align-items-center gap-3">
            <span class="text-white small">
              👤 {{ userEmail }}
              <span v-if="isAdmin" class="badge bg-dark ms-1">ADMIN</span>
            </span>
            <button @click="logout" class="btn btn-danger btn-sm">
              🚪 Abmelden
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="container-fluid p-3 p-md-4">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/supabase'

const router = useRouter()
const isAdmin = ref(false)
const userEmail = ref('')

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    userEmail.value = session.user.email

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

    isAdmin.value = userData?.role === 'admin'
  }
})

async function logout() {
  localStorage.removeItem('auth_credentials')
  await supabase.auth.signOut()
  await router.push('/login')
}
</script>

<style scoped>
.nav-link {
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 0.8;
}

.router-link-active {
  font-weight: 600;
  border-bottom: 2px solid white;
}
</style>