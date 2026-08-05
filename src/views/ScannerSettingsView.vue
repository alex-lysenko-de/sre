<!-- src/views/ScannerSettingsView.vue -->
<!-- Einstellungen des Scanner-Moduls (tickets/126/126.txt, Punkt 4): Kamera
     und Anzeigedauern der Bestaetigungsbildschirme, ausgelagert aus dem
     eigentlichen Scan-Bildschirm (Scanner.vue), damit dieser waehrend des
     Scannens frei von Steuerelementen bleibt, die nur einmalig pro Geraet
     eingestellt werden. Enthaelt keine eigene Scan-Logik. -->

<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'cog']"/>
          Scanner-Einstellungen
        </h3>
      </div>

      <div class="card-body">
        <div class="mb-4">
          <label class="form-label fw-semibold text-dark">Kamera</label>

          <div v-if="loadingCameras" class="text-muted small mb-2">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Kameraliste wird geladen...
          </div>
          <div v-else-if="cameraLoadError" class="alert alert-danger py-2 px-3 small mb-2">
            {{ cameraLoadError }}
            <button class="btn btn-sm btn-outline-danger ms-2" @click="loadCameras">
              Erneut versuchen
            </button>
          </div>

          <div class="list-group">
            <button
                type="button"
                class="list-group-item list-group-item-action"
                :class="{ active: settings.preferredCameraId.value === null }"
                @click="settings.setPreferredCameraId(null)"
            >
              Automatische Kamerawahl
            </button>
            <button
                v-for="cam in settings.cameraList.value"
                :key="cam.id"
                type="button"
                class="list-group-item list-group-item-action"
                :class="{ active: settings.preferredCameraId.value === cam.id }"
                @click="settings.setPreferredCameraId(cam.id)"
            >
              {{ cam.label || cam.id }}
            </button>
          </div>
        </div>

        <div class="mb-3">
          <label for="successDuration" class="form-label fw-semibold text-dark">
            Anzeigedauer bei Erfolg: {{ settings.successDurationMs.value }} ms
          </label>
          <input
              id="successDuration"
              type="range"
              class="form-range"
              min="500"
              max="5000"
              step="100"
              :value="settings.successDurationMs.value"
              @change="settings.setSuccessDurationMs(Number($event.target.value))"
          >
        </div>

        <div class="mb-3">
          <label for="errorDuration" class="form-label fw-semibold text-dark">
            Anzeigedauer bei Fehler: {{ settings.errorDurationMs.value }} ms
          </label>
          <input
              id="errorDuration"
              type="range"
              class="form-range"
              min="500"
              max="5000"
              step="100"
              :value="settings.errorDurationMs.value"
              @change="settings.setErrorDurationMs(Number($event.target.value))"
          >
        </div>

        <hr class="my-4">

        <div class="mb-3">
          <label for="confirmResumeRetries" class="form-label fw-semibold text-dark">
            Versuche zur Wiederaufnahme-Prüfung: {{ settings.confirmResumeRetries.value }}
          </label>
          <input
              id="confirmResumeRetries"
              type="range"
              class="form-range"
              :min="retriesRange.min"
              :max="retriesRange.max"
              :step="retriesRange.step"
              :value="settings.confirmResumeRetries.value"
              @change="settings.setConfirmResumeRetries(Number($event.target.value))"
          >
          <div class="form-text">
            Nach dem schnellen Fortsetzen der Kamera wird so oft geprüft, ob sie
            wirklich wieder scannt, bevor auf einen Kaltstart zurückgefallen wird.
          </div>
        </div>

        <div class="mb-3">
          <label for="confirmResumeDelayMs" class="form-label fw-semibold text-dark">
            Abstand zwischen den Prüfungen: {{ settings.confirmResumeDelayMs.value }} ms
          </label>
          <input
              id="confirmResumeDelayMs"
              type="range"
              class="form-range"
              :min="delayRange.min"
              :max="delayRange.max"
              :step="delayRange.step"
              :value="settings.confirmResumeDelayMs.value"
              @change="settings.setConfirmResumeDelayMs(Number($event.target.value))"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  useScannerSettings,
  CONFIRM_RESUME_RETRIES_RANGE,
  CONFIRM_RESUME_DELAY_MS_RANGE
} from '@/composables/useScannerSettings'

const settings = useScannerSettings()
const retriesRange = CONFIRM_RESUME_RETRIES_RANGE
const delayRange = CONFIRM_RESUME_DELAY_MS_RANGE

const loadingCameras = ref(true)
const cameraLoadError = ref('')

const loadCameras = async () => {
  loadingCameras.value = true
  cameraLoadError.value = ''
  try {
    await settings.loadCameraList()
  } catch (error) {
    console.error('❌ Fehler beim Laden der Kameraliste:', error)
    cameraLoadError.value = 'Kein Zugriff auf die Kamera. Bitte Berechtigungen prüfen.'
  } finally {
    loadingCameras.value = false
  }
}

onMounted(() => {
  loadCameras()
})
</script>

<style scoped>
.main-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
}

.card {
  border: none;
  border-radius: 12px;
}

.list-group-item.active {
  background-color: #28a745;
  border-color: #28a745;
}
</style>
