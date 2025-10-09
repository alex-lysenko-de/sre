<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-4">
    <div class="max-w-2xl mx-auto">
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2 text-center">
          🎟️ Einladungsgenerator
        </h1>
        <p class="text-gray-600 text-center mb-8">
          Erstellung von Links zur Registrierung neuer Benutzer
        </p>

        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <span class="text-yellow-400 text-xl">⚠️</span>
            </div>
            <div class="ml-3">
              <p class="text-sm text-yellow-700">
                <strong>Achtung!</strong> Einladungen gewähren Zugang zum System.
                Senden Sie diese nur an vertrauenswürdige Personen.
              </p>
            </div>
          </div>
        </div>

        <form @submit.prevent="generateInvite" class="space-y-6">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Benutzerrolle
            </label>
            <select
                v-model="role"
                required
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="user">Betreuer (user)</option>
              <option value="admin">HauptBetreuer (admin)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Gültigkeitsdauer
            </label>
            <select
                v-model="expiresInHours"
                required
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
              class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <span v-if="loading">⏳ Generierung...</span>
            <span v-else>✨ QR-Code generieren</span>
          </button>
        </form>

        <div v-if="error" class="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ❌ {{ error }}
        </div>

        <div v-if="inviteUrl" class="mt-8 p-6 bg-gray-50 rounded-xl">
          <div class="inline-block bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold mb-4">
            ✓ Erfolgreich erstellt
          </div>

          <h3 class="text-xl font-semibold text-gray-800 mb-4 text-center">
            QR-Code zur Registrierung
          </h3>

          <div class="flex justify-center mb-6 p-6 bg-white rounded-lg shadow-md">
            <div ref="qrcodeContainer"></div>
          </div>

          <div class="mb-4">
            <div class="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Registrierungslink
            </div>
            <div class="flex gap-2">
              <input
                  :value="inviteUrl"
                  readonly
                  class="flex-1 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-sm font-mono text-gray-700"
              />
              <button
                  @click="copyToClipboard"
                  class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm"
              >
                📋 Kopieren
              </button>
            </div>
          </div>

          <div class="mb-6">
            <a
                :href="whatsappUrl"
                target="_blank"
                class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              <span class="text-xl">📱</span>
              Über WhatsApp senden
            </a>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded-lg border border-gray-200">
              <div class="text-xs font-semibold text-gray-500 uppercase mb-1">
                Rolle
              </div>
              <div class="text-sm font-bold text-gray-800">
                {{ role === 'admin' ? 'Administrator' : 'Benutzer' }}
              </div>
            </div>
            <div class="bg-white p-3 rounded-lg border border-gray-200">
              <div class="text-xs font-semibold text-gray-500 uppercase mb-1">
                Läuft ab
              </div>
              <div class="text-sm font-bold text-gray-800">
                {{ formatExpiryDate(expiresAt) }}
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

const role = ref('user')
const expiresInHours = ref(24)
const loading = ref(false)
const error = ref('')
const inviteUrl = ref('')
const expiresAt = ref('')
const qrcodeContainer = ref(null)

const currentUrl = computed(() => {
  return `${window.location.protocol}//${window.location.host}`
})

const whatsappUrl = computed(() => {
  if (!inviteUrl.value) return ''
  const message = `Einladung zur Registrierung bei Stadtranderholung:\n${inviteUrl.value}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
})

async function generateInvite() {
  loading.value = true
  error.value = ''
  inviteUrl.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Nicht autorisiert')

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
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    inviteUrl.value = `${currentUrl.value}/welcome?invite=${data.inviteToken}`
    expiresAt.value = data.expiresAt

    // QR-Code generieren
    await nextTick(async () => { // <-- WRAP IN NEXT TICK
      await generateQRCode()
    })

  } catch (err) {
    console.error('Generierungsfehler:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function generateQRCode() {
  if (!qrcodeContainer.value) return

  qrcodeContainer.value.innerHTML = ''

  try {
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, inviteUrl.value, {
      width: 256,
      margin: 2,
      color: {
        dark: '#4F46E5',
        light: '#FFFFFF'
      }
    })
    qrcodeContainer.value.appendChild(canvas)
  } catch (err) {
    console.error('Fehler beim Erstellen des QR-Codes:', err)
  }
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    alert('✓ Link wurde in die Zwischenablage kopiert!')
  } catch (err) {
    console.error('Kopieren fehlgeschlagen:', err)
    alert('Kopieren fehlgeschlagen. Bitte manuell kopieren.')
  }
}

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