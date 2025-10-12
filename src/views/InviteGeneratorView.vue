<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'ticket-alt']" />
          Einladungsgenerator
        </h3>
        <p class="mb-0 mt-2">Erstellung von Links zur Registrierung neuer Benutzer</p>
      </div>
      <div class="card-body">

        <div class="alert alert-warning border-start border-4 border-warning p-3 mb-4 d-flex align-items-start" role="alert">
          <div class="flex-shrink-0 me-3">
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-warning fs-4" />
          </div>
          <div>
            <strong>Achtung!</strong> Einladungen gewähren Zugang zum System.
            Senden Sie diese nur an vertrauenswürdige Personen.
          </div>
        </div>

        <form @submit.prevent="generateInvite" class="space-y-4">
          <div class="mb-3">
            <label for="roleSelect" class="form-label">Benutzerrolle</label>
            <select
                id="roleSelect"
                v-model="role"
                required
                class="form-select"
            >
              <option value="user">Betreuer (user)</option>
              <option value="admin">HauptBetreuer (admin)</option>
            </select>
          </div>

          <div class="mb-4">
            <label for="expirySelect" class="form-label">Gültigkeitsdauer</label>
            <select
                id="expirySelect"
                v-model="expiresInHours"
                required
                class="form-select"
            >
              <option :value="1">1 Stunde</option>
              <option :value="24">24 Stunden (1 Tag)</option>
              <option :value="72">72 Stunden (3 Tage)</option>
              <option :value="168">168 Stunden (7 Tage)</option>
            </select>
          </div>

          <button
              type="submit"
              :disabled="loading"
              class="btn btn-primary btn-lg w-100"
          >
            <span v-if="loading">
              <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Generierung...
            </span>
            <span v-else>
              <font-awesome-icon :icon="['fas', 'qrcode']" />
              QR-Code generieren
            </span>
          </button>
        </form>

        <div v-if="error" class="mt-4 alert alert-danger" role="alert">
          <font-awesome-icon :icon="['fas', 'times-circle']" class="me-2" />
          {{ error }}
        </div>

        <div v-if="inviteUrl" class="mt-4 p-4 border rounded bg-light">
          <div class="text-center mb-3">
            <span class="badge bg-success mb-3">
              <font-awesome-icon :icon="['fas', 'check']" class="me-1" />
              Erfolgreich erstellt
            </span>
            <h4 class="font-weight-bold text-dark mb-0">
              QR-Code zur Registrierung
            </h4>
          </div>

          <div class="d-flex justify-content-center mb-4 p-3 bg-white rounded shadow-sm">
            <div ref="qrcodeContainer"></div>
          </div>

          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold">
              Registrierungslink
            </label>
            <div class="input-group">
              <input
                  :value="inviteUrl"
                  readonly
                  class="form-control"
              />
              <button
                  @click="copyToClipboard"
                  class="btn btn-success"
                  type="button"
              >
                <font-awesome-icon :icon="['fas', 'clipboard']" /> Kopieren
              </button>
            </div>
          </div>

          <div class="mb-4">
            <a
                :href="whatsappUrl"
                target="_blank"
                class="btn btn-success w-100 d-flex align-items-center justify-content-center"
            >
              <font-awesome-icon :icon="['fab', 'whatsapp']" class="me-2 fs-5" />
              Über WhatsApp senden
            </a>
          </div>

          <div class="row g-2">
            <div class="col-6">
              <div class="p-3 bg-white rounded border">
                <div class="text-muted small text-uppercase mb-1">
                  Rolle
                </div>
                <div class="fw-bold text-dark">
                  {{ role === 'admin' ? 'Hauptbetreuer' : 'Betreuer' }}
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="p-3 bg-white rounded border">
                <div class="text-muted small text-uppercase mb-1">
                  Läuft ab
                </div>
                <div class="fw-bold text-dark">
                  {{ formatExpiryDate(expiresAt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { supabase } from '@/supabase'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome' // Import icon component

// Reactive state variables
const role = ref('user')
const expiresInHours = ref(24)
const loading = ref(false)
const error = ref('')
const inviteUrl = ref('')
const expiresAt = ref('')
const qrcodeContainer = ref(null)

// Computed property to construct the base URL for the invitation link
const currentUrl = computed(() => {
  // Get the base path from Vite env. e.g., '/sre/'
  const basePath = import.meta.env.BASE_URL;
  // Get the origin: e.g., 'https://username.github.io'
  const origin = `${window.location.protocol}//${window.location.host}`;
  // Construct the full base URL: e.g., 'https://username.github.io/sre' (remove trailing slash for clean path joining)
  return basePath.endsWith('/') ? origin + basePath.slice(0, -1) : origin + basePath;
})

// Computed property for the WhatsApp share link
const whatsappUrl = computed(() => {
  if (!inviteUrl.value) return ''
  const message = `Einladung zur Registrierung bei Stadtranderholung:\n${inviteUrl.value}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
})

/**
 * Generates an invitation token via a Supabase Edge Function.
 */
async function generateInvite() {
  loading.value = true
  error.value = ''
  inviteUrl.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Nicht autorisiert. Bitte melden Sie sich an.') // Message translated

    // Supabase Edge Function URL structure
    const API_URL = import.meta.env.VITE_SUPABASE_URL.replace('.co', '.co/functions/v1')

    const response = await fetch(`${API_URL}/invite-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_KEY
      },
      body: JSON.stringify({
        role: role.value,
        expiresInHours: expiresInHours.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP Fehler! Status: ${response.status}`) // Message translated
    }

    const data = await response.json()
    // Construct the full registration URL
    inviteUrl.value = `${currentUrl.value}/welcome?invite=${data.inviteToken}`
    expiresAt.value = data.expiresAt

    // Generate QR code after Vue has updated the DOM
    await nextTick(async () => {
      await generateQRCode()
    })

  } catch (err) {
    console.error('Generierungsfehler:', err) // Console message remains English/German mix for development purposes
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/**
 * Generates the QR code and appends it to the container.
 */
async function generateQRCode() {
  if (!qrcodeContainer.value) return

  // Clear previous content
  qrcodeContainer.value.innerHTML = ''

  try {
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, inviteUrl.value, {
      width: 200, // Slightly smaller for better fit in the card
      margin: 2,
      color: {
        dark: '#007bff', // Bootstrap primary blue
        light: '#FFFFFF'
      }
    })
    qrcodeContainer.value.appendChild(canvas)
  } catch (err) {
    console.error('Fehler beim Erstellen des QR-Codes:', err) // Console message remains English/German mix for development purposes
  }
}

/**
 * Copies the invitation URL to the clipboard.
 */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    alert('✓ Link wurde in die Zwischenablage kopiert!') // Message translated
  } catch (err) {
    console.error('Kopieren fehlgeschlagen:', err) // Console message remains English/German mix for development purposes
    alert('Kopieren fehlgeschlagen. Bitte manuell kopieren.') // Message translated
  }
}

/**
 * Formats the expiry date for display in German locale.
 * @param {string} dateStr - The date string from the API.
 * @returns {string} The formatted date/time string.
 */
function formatExpiryDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style>
/* Styles copied from DaysEditView.vue */
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
  max-width: 650px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card + .card {
  margin-top: 20px;
}

.card-header {
  background-color: #007bff;
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}
/* End of copied styles */

/* Specific adjustment for the form */
.w-100 {
  width: 100% !important;
}
.btn-lg {
  padding: 0.5rem 1rem;
  font-size: 1.25rem;
  border-radius: 0.3rem;
}
</style>