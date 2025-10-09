<template>
  <div class="p-6 max-w-md mx-auto">
    <h1 class="text-2xl font-bold mb-4">🎟 Registrierung per Einladung</h1>

    <div v-if="!inviteToken">
      <p>Keine Einladung. Überprüfen Sie den Link.</p>
    </div>

    <form v-else @submit.prevent="register">
      <input v-model="email" placeholder="Email" type="email" required class="border p-2 w-full mb-3" />
      <input v-model="password" placeholder="Passwort" type="password" required class="border p-2 w-full mb-3" />
      <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded">Konto erstellen</button>
    </form>

    <p v-if="error" class="text-red-600 mt-4">❌ {{ error }}</p>
    <p v-if="success" class="text-green-600 mt-4">✅ Benutzer erstellt! Sie können sich jetzt anmelden.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const inviteToken = ref(null)
const email = ref('')
const password = ref('')
const error = ref('')
const success = ref(false)

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  inviteToken.value = params.get('invite')
})

async function register() {
  try {
    error.value = ''
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL.replace('.co', '.co/functions/v1')}/invite-accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken.value, email: email.value, password: password.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    success.value = true
  } catch (err) {
    error.value = err.message
  }
}
</script>