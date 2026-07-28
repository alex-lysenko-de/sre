<!-- src/views/ChildEditPrototypeView.vue -->
<!-- Ticket 130_2 - UX-Feedback Runde 4: funktionales Mock-Edit fuer die
     Kind-Karte (bewusst vereinbart - siehe Klaerungsfrage in der Planung).
     Aendert nur Name/Alter/Schwimmabzeichen/Notizen direkt in der reactive-
     Instanz von useChildEntityMock.js - keine Persistenz, kein Supabase.
     Gruppe/Eltern/Telefon/Armband bleiben ausserhalb dieses Bearbeitungs-
     umfangs (siehe updateChild()). -->
<template>
  <div class="cp-child-edit-view">
    <DebugTag variant="page" label="Page 7" />

    <div class="cp-header-top">
      <DebugTag label="el1" />
      <button class="cp-back-btn me-2" @click="goToCard">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      <span class="cp-header-title">Kind bearbeiten</span>
    </div>

    <template v-if="child">
      <div class="card">
        <div class="card-body">
          <DebugTag label="el2" />
          <div class="mb-3">
            <label class="form-label fw-bold">Name</label>
            <input v-model="form.name" type="text" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Alter</label>
            <input v-model.number="form.age" type="number" min="0" max="20" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Schwimmabzeichen</label>
            <select v-model.number="form.schwimmer" class="form-select">
              <option v-for="(label, level) in SWIM_LEVELS" :key="level" :value="Number(level)">{{ label }}</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Notizen</label>
            <textarea v-model="form.notes" class="form-control" rows="3"></textarea>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-success flex-fill" @click="onSave">
              <font-awesome-icon :icon="['fas', 'check-circle']" class="me-1" />
              Speichern
            </button>
            <button class="btn btn-secondary flex-fill" @click="goToCard">Abbrechen</button>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="alert alert-danger">Kind nicht gefunden.</div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getChildById, updateChild } from '@/composables/useChildEntityMock'
import { SWIM_LEVELS } from '@/utils/utils'
import DebugTag from '@/components/checkpoints-prototype/DebugTag.vue'

const route = useRoute()
const router = useRouter()

const child = computed(() => getChildById(Number(route.params.id)))

const form = reactive({ name: '', age: 0, schwimmer: 0, notes: '' })

function loadForm() {
  if (!child.value) return
  form.name = child.value.name
  form.age = child.value.age
  form.schwimmer = child.value.schwimmer
  form.notes = child.value.notes
}

function onSave() {
  updateChild(child.value.id, { ...form })
  goToCard()
}

function goToCard() {
  router.push(`/admin/checkpoints-prototype/child/${route.params.id}`)
}

onMounted(loadForm)
</script>

<style scoped>
.cp-child-edit-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  font-size: 1.05rem;
}

.cp-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.cp-header-title {
  font-size: 1.4rem;
  font-weight: 700;
}

.cp-back-btn {
  border: none;
  border-radius: 8px;
  background-color: #e9ecef;
  color: #495057;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}
</style>
