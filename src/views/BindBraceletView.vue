<template>
  <div class="bind-view">
    <div class="row justify-content-center">
      <div class="col-12 col-lg-8">
        <div class="card shadow">
          <div class="card-body p-4">
            <h2 class="mb-4">🔗 Armband zuordnen</h2>

            <!-- Loading -->
            <div v-if="loading" class="text-center py-5">
              <div class="spinner-border text-success">
                <span class="visually-hidden">Laden...</span>
              </div>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="alert alert-danger">
              {{ error }}
            </div>

            <!-- Main Content -->
            <div v-else>
              <!-- Band Info -->
              <div class="alert alert-info mb-4">
                <h5>📱 Armband-Code: <strong>{{ bandCode }}</strong></h5>
                <p class="mb-0" v-if="bandData">
                  Label: {{ bandData.label || 'Kein Label' }} |
                  Status: {{ bandData.active ? '✅ Aktiv' : '❌ Inaktiv' }}
                </p>
              </div>

              <!-- Option 1: Bind to existing child -->
              <div class="card mb-4">
                <div class="card-header bg-success text-white">
                  <h5 class="mb-0">Option 1: Bestehendes Kind zuordnen</h5>
                </div>
                <div class="card-body">
                  <div class="mb-3">
                    <label class="form-label fw-semibold">Kind auswählen</label>
                    <select
                        v-model="selectedChildId"
                        class="form-select form-select-lg"
                    >
                      <option value="">-- Bitte wählen --</option>
                      <option
                          v-for="child in unboundChildren"
                          :key="child.id"
                          :value="child.id"
                      >
                        {{ child.name }} ({{ child.age }} Jahre) - {{ child.groups?.name || 'Keine Gruppe' }}
                      </option>
                    </select>
                  </div>
                  <button
                      @click="bindToExisting"
                      :disabled="!selectedChildId || binding"
                      class="btn btn-success"
                  >
                    <span v-if="binding">
                      <span class="spinner-border spinner-border-sm me-2"></span>
                      Wird zugeordnet...
                    </span>
                    <span v-else>🔗 Zuordnen</span>
                  </button>
                </div>
              </div>

              <!-- Option 2: Create new child -->
              <div class="card">
                <div class="card-header bg-primary text-white">
                  <h5 class="mb-0">Option 2: Neues Kind erstellen</h5>
                </div>
                <div class="card-body">
                  <form @submit.prevent="createAndBind">
                    <div class="row g-3">
                      <div class="col-md-6">
                        <label class="form-label fw-semibold">Name *</label>
                        <input
                            v-model="newChild.name"
                            type="text"
                            required
                            class="form-control"
                            placeholder="Max Mustermann"
                        />
                      </div>
                      <div class="col-md-6">
                        <label class="form-label fw-semibold">Alter *</label>
                        <input
                            v-model.number="newChild.age"
                            type="number"
                            required
                            min="3"
                            max="18"
                            class="form-control"
                            placeholder="8"
                        />
                      </div>
                      <div class="col-md-6">
                        <label class="form-label fw-semibold">Gruppe</label>
                        <select v-model="newChild.group_id" class="form-select">
                          <option value="">Keine Gruppe</option>
                          <option
                              v-for="group in groups"
                              :key="group.id"
                              :value="group.id"
                          >
                            {{ group.name }}
                          </option>
                        </select>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label fw-semibold">Schwimmer</label>
                        <div class="form-check form-switch mt-2">
                          <input
                              v-model="newChild.schwimmer"
                              type="checkbox"
                              class="form-check-input"
                              id="schwimmerSwitch"
                          />
                          <label class="form-check-label" for="schwimmerSwitch">
                            {{ newChild.schwimmer ? '🏊 Ja' : '❌ Nein' }}
                          </label>
                        </div>
                      </div>
                      <div class="col-12">
                        <label class="form-label fw-semibold">Notizen</label>
                        <textarea
                            v-model="newChild.notes"
                            class="form-control"
                            rows="3"
                            placeholder="Optional: Besondere Hinweise..."
                        ></textarea>
                      </div>
                    </div>

                    <div class="mt-3">
                      <button
                          type="submit"
                          :disabled="binding"
                          class="btn btn-primary"
                      >
                        <span v-if="binding">
                          <span class="spinner-border spinner-border-sm me-2"></span>
                          Wird erstellt...
                        </span>
                        <span v-else>➕ Erstellen und zuordnen</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <!-- Back button -->
              <div class="mt-4">
                <button @click="goBack" class="btn btn-secondary">
                  ← Zurück
                </button>
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
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/supabase'
import { logApi } from '@/utils/logger'

const router = useRouter()
const route = useRoute()

const bandCode = ref('')
const bandData = ref(null)
const loading = ref(true)
const error = ref('')
const binding = ref(false)

const selectedChildId = ref('')
const unboundChildren = ref([])
const groups = ref([])

const newChild = ref({
  name: '',
  age: 6,
  group_id: '',
  schwimmer: false,
  notes: ''
})

onMounted(async () => {
  bandCode.value = route.query.n

  if (!bandCode.value) {
    error.value = 'Kein Armband-Code angegeben'
    loading.value = false
    return
  }

  await loadData()
})

async function loadData() {
  loading.value = true

  try {
    // Load band
    const { data: band, error: bandError } = await supabase
        .from('c_bands')
        .select('*')
        .eq('code', bandCode.value)
        .single()

    logApi('Load band', { data: band, error: bandError })

    if (bandError || !band) {
      error.value = 'Armband nicht gefunden'
      loading.value = false
      return
    }

    bandData.value = band

    // Load unbound children (children without band_id)
    const { data: children, error: childrenError } = await supabase
        .from('children')
        .select('*, groups(name)')
        .is('band_id', null)
        .order('name')

    logApi('Load unbound children', { data: children, error: childrenError })

    if (!childrenError) {
      unboundChildren.value = children || []
    }

    // Load groups
    const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('name')

    logApi('Load groups', { data: groupsData, error: groupsError })

    if (!groupsError) {
      groups.value = groupsData || []
    }

  } catch (err) {
    console.error('Load error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function bindToExisting() {
  if (!selectedChildId.value) return

  binding.value = true

  try {
    const { error: updateError } = await supabase
        .from('children')
        .update({ band_id: bandData.value.id })
        .eq('id', selectedChildId.value)

    logApi('Bind to existing child', { error: updateError })

    if (updateError) throw updateError

    alert('✅ Armband erfolgreich zugeordnet!')

    // Redirect to scan page to record the scan
    await router.push(`/main/scan?n=${bandCode.value}`)

  } catch (err) {
    console.error('Bind error:', err)
    alert('❌ Fehler: ' + err.message)
  } finally {
    binding.value = false
  }
}

async function createAndBind() {
  if (!newChild.value.name) {
    alert('Bitte Name eingeben')
    return
  }

  binding.value = true

  try {
    // Create new child with band_id
    const childData = {
      name: newChild.value.name,
      age: newChild.value.age,
      group_id: newChild.value.group_id || null,
      schwimmer: newChild.value.schwimmer,
      notes: newChild.value.notes,
      band_id: bandData.value.id,
      created_at: new Date().toISOString()
    }

    const { data: child, error: insertError } = await supabase
        .from('children')
        .insert(childData)
        .select()
        .single()

    logApi('Create new child with band', { data: child, error: insertError })

    if (insertError) throw insertError

    alert('✅ Kind erstellt und Armband zugeordnet!')

    // Redirect to scan page
    await router.push(`/main/scan?n=${bandCode.value}`)

  } catch (err) {
    console.error('Create error:', err)
    alert('❌ Fehler: ' + err.message)
  } finally {
    binding.value = false
  }
}

function goBack() {
  router.back()
}
</script>

<style scoped>
.bind-view {
  max-width: 100%;
}

.card-header {
  font-weight: 600;
}

.form-check-input:checked {
  background-color: #198754;
  border-color: #198754;
}
</style>