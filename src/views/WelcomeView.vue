<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center py-4" style="background: linear-gradient(135deg, #e8f5e9 0%, #bbdefb 100%);">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
          <div class="card shadow-lg border-0 rounded-4">
            <div class="card-body p-4 p-sm-5">
              <!-- Header -->
              <div class="text-center mb-4">
                <h1 class="h3 fw-bold text-success mb-2">
                  🌳 Willkommen!
                </h1>
                <p class="text-muted">
                  Registrierung bei Stadtranderholung
                </p>
              </div>

              <!-- No Token Error -->
              <div v-if="!inviteToken" class="text-center py-5">
                <div class="display-1 mb-3">⚠️</div>
                <h5 class="text-danger fw-semibold mb-2">
                  Einladungstoken fehlt
                </h5>
                <p class="text-muted">
                  Überprüfen Sie die Richtigkeit des Links
                </p>
              </div>

              <!-- Registration Form -->
              <form v-else @submit.prevent="handleRegister" class="needs-validation" novalidate>
                <div class="mb-3">
                  <label for="name" class="form-label fw-semibold">Name *</label>
                  <input
                    v-model="name"
                    id="name"
                    type="text"
                    required
                    placeholder="Geben Sie Ihren Namen ein"
                    class="form-control form-control-lg"
                  />
                </div>

                <div class="mb-3">
                  <label for="email" class="form-label fw-semibold">Email *</label>
                  <input
                    v-model="email"
                    id="email"
                    type="email"
                    required
                    placeholder="example@email.com"
                    autocomplete="username"
                    class="form-control form-control-lg"
                  />
                </div>

                <div class="mb-3">
                  <label for="phone" class="form-label fw-semibold">Telefon *</label>
                  <input
                    v-model="phone"
                    id="phone"
                    type="tel"
                    required
                    placeholder="+49 123 456789"
                    class="form-control form-control-lg"
                  />
                </div>

                <div class="mb-3">
                  <label for="password" class="form-label fw-semibold">Passwort *</label>
                  <input
                    v-model="password"
                    id="password"
                    type="password"
                    required
                    minlength="8"
                    placeholder="Mindestens 8 Zeichen"
                    autocomplete="new-password"
                    class="form-control form-control-lg"
                  />
                  <div class="form-text">Mindestens 8 Zeichen erforderlich</div>
                </div>

                <div class="mb-4">
                  <label for="confirmPassword" class="form-label fw-semibold">Passwort bestätigen *</label>
                  <input
                    v-model="confirmPassword"
                    id="confirmPassword"
                    type="password"
                    required
                    minlength="8"
                    placeholder="Wiederholen Sie das Passwort"
                    autocomplete="new-password"
                    class="form-control form-control-lg"
                  />
                </div>

                <!-- Error Alert -->
                <div v-if="error" class="alert alert-danger d-flex align-items-start py-2 mb-3" role="alert">
                  <span class="me-2">⚠️</span>
                  <div>{{ error }}</div>
                </div>

                <!-- Success Alert -->
                <div v-if="success" class="alert alert-success d-flex align-items-center py-2 mb-3" role="alert">
                  <span class="me-2">✅</span>
                  <div>Registrierung erfolgreich! Weiterleitung...</div>
                </div>

                <!-- Submit Button -->
                <button
                  type="submit"
                  :disabled="loading || success"
                  class="btn btn-success btn-lg w-100 fw-semibold"
                >
                  <span v-if="loading">
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Konto wird erstellt...
                  </span>
                  <span v-else-if="success">✓ Fertig!</span>
                  <span v-else>🚀 Konto erstellen</span>
                </button>
              </form>

              <!-- Link to Login -->
              <div v-if="inviteToken" class="mt-4 text-center">
                <p class="text-muted small mb-1">Haben Sie bereits ein Konto?</p>
                <router-link to="/login" class="text-success fw-semibold text-decoration-none">
                  Anmelden →
                </router-link>
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
import { supabase } from '@/supabase'

const router = useRouter()

const inviteToken = ref(null)
const name = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  inviteToken.value = params.get('invite')

  if (!inviteToken.value) {
    console.error('⚠️ Einladungstoken nicht in der URL gefunden')
  }
})

async function handleRegister() {
  error.value = ''

  // Validation
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwörter stimmen nicht überein'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Das Passwort muss mindestens 8 Zeichen enthalten'
    return
  }

  loading.value = true

  try {
    const API_URL = import.meta.env.VITE_SUPABASE_URL.replace('.co', '.co/functions/v1')

    const response = await fetch(`${API_URL}/invite-accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`
      },
      body: JSON.stringify({
        token: inviteToken.value,
        email: email.value,
        password: password.value,
        name: name.value,
        phone: phone.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Registrierungsfehler')
    }

    // NEU: Setzt den permanenten Status, dass der Nutzer registriert ist
    localStorage.setItem('sre_user_registered', 'true');
    console.log('✅ Registrierungsstatus im localStorage nach Registrierung gespeichert.');


    success.value = true
    console.log('✅ Benutzer erfolgreich registriert')

    // Auto-login after registration
    setTimeout(async () => {
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.value,
          password: password.value
        })

        if (signInError) throw signInError

        await router.push('/info')
      } catch (err) {
        console.error('Fehler bei der automatischen Anmeldung:', err)
        await router.push('/login')
      }
    }, 1500)

  } catch (err) {
    console.error('Registrierungsfehler:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
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