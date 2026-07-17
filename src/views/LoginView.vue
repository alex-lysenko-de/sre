<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-gradient" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
          <div class="card shadow-lg border-0 rounded-4">
            <div class="card-body p-4 p-sm-5">
              <!-- Header -->
              <div class="text-center mb-4">
                <h1 class="h3 fw-bold text-success mb-2">🌳 Stadtranderholung</h1>
                <p class="text-muted small">Systemanmeldung</p>
              </div>

              <!-- Session check spinner -->
              <div v-if="autoLoginInProgress" class="text-center py-5">
                <div class="spinner-border text-success" style="width: 4rem; height: 4rem;" role="status">
                  <span class="visually-hidden">Laden...</span>
                </div>
                <p class="mt-3 text-muted">Sitzung wird geprüft...</p>
              </div>

              <!-- Login Form -->
              <form v-else @submit.prevent="handleLogin">
                <div class="mb-3">
                  <label for="email" class="form-label fw-semibold">Email</label>
                  <input
                    v-model="email"
                    id="email"
                    type="email"
                    required
                    autocomplete="username"
                    class="form-control form-control-lg"
                    placeholder="your@email.com"
                  />
                </div>

                <div class="mb-3">
                  <label for="password" class="form-label fw-semibold">Passwort</label>
                  <input
                    v-model="password"
                    id="password"
                    type="password"
                    required
                    autocomplete="current-password"
                    class="form-control form-control-lg"
                    placeholder=""
                  />
                </div>

                <!-- Error Alert -->
                <div v-if="error" class="alert alert-danger d-flex align-items-center py-2" role="alert">
                  <span class="me-2">⚠️</span>
                  <div>{{ error }}</div>
                </div>

                <!-- Submit Button -->
                <button
                  type="submit"
                  :disabled="loading"
                  class="btn btn-success btn-lg w-100 fw-semibold"
                >
                  <span v-if="loading">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Anmelden...
                  </span>
                  <span v-else>🔐 Anmelden</span>
                </button>
              </form>

              <!-- Default Credentials -->
              <div class="mt-4 text-center">
                <p class="text-muted small mb-1"></p>
                <code class="small"></code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { logApi } from '../utils/logger'
import { setAuthItem } from '../modules/storage'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const autoLoginInProgress = ref(true)

// Check for existing session on mount
onMounted(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // User is already authenticated
      console.log('✅ Aktive Sitzung gefunden, leite weiter...')
      await redirectToHome()
    }
  } catch (err) {
    console.error('Fehler bei der Sitzungsprüfung:', err)
  } finally {
    autoLoginInProgress.value = false
  }
})

// Handle manual login
async function handleLogin() {
  loading.value = true
  error.value = ''

  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (authError) throw authError

    // Check user role
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('role, active')
      .eq('user_id', data.user.id)
      .single()

    logApi('Login → fetch user', { data: userData, error: dbError })

    if (dbError) throw new Error('Fehler bei der Abfrage von users: ' + dbError.message)
    if (!userData) throw new Error('Benutzer im System nicht gefunden')

    if (!userData.active) {
      await supabase.auth.signOut()
      throw new Error('Ihr Konto ist deaktiviert')
    }

    if (userData.role !== 'admin' && userData.role !== 'user') {
      await supabase.auth.signOut()
      throw new Error('Unzureichende Rechte für die Anmeldung')
    }

    // NEU: Setzt den permanenten Status, dass der Nutzer registriert ist
    await setAuthItem('sre_user_registered', 'true');
    console.log('✅ Registrierungsstatus gespeichert.');

    // Update last_seen_date
    await supabase
      .from('users')
      .update({ last_seen_date: new Date().toISOString() })
      .eq('user_id', data.user.id)

    console.log('✅ Anmeldung erfolgreich abgeschlossen')
    await redirectToHome()
  } catch (err) {
    error.value = err.message
    console.error('⚠️ Anmeldefehler:', err)
  } finally {
    loading.value = false
  }
}

// Redirect to home page
async function redirectToHome() {
  await router.push('/info')
}
</script>

<style scoped>
.rounded-4 {
  border-radius: 1rem;
}

.form-control:focus {
  border-color: #198754;
  box-shadow: 0 0 0 0.25rem rgba(25, 135, 84, 0.25);
}
</style>
