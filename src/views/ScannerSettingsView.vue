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

          <div class="preview-square mt-2">
            <div id="qr-settings-preview"></div>

            <div v-if="previewState === 'idle'" class="preview-overlay">
              Kamera wird beim Scannen automatisch gewählt
            </div>
            <div v-else-if="previewState === 'starting'" class="preview-overlay">
              <div class="spinner-border spinner-border-sm text-light me-2" role="status"></div>
              Kamera wird gestartet...
            </div>
            <div v-else-if="previewState === 'error'" class="preview-overlay">
              <div class="alert alert-danger py-2 px-3 small mb-0">
                {{ previewError }}
              </div>
            </div>
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
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

// ============================================
// LIVE-VORSCHAU DER GEWAEHLTEN KAMERA (tickets/152/152.txt)
// ============================================
// Eigenstaendige, bewusst nicht mit Scanner.vue geteilte Kamera-Logik - siehe
// tickets/152/IMPLEMENTATION_PLAN.md, "Neue Komponenten": Scanner.vue ist kein
// "nackter" Kamera-Baustein, sondern an Resolve/Feedback/Bestaetigung
// gebunden, was hier explizit nicht gewuenscht ist (152.txt, Punkt 4).
const PREVIEW_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0
}

let html5QrCode = null
// Analog scannerActive in Scanner.vue - eigenstaendig vom previewState-Ref
// gefuehrt, damit stopPreview() auch dann korrekt entscheidet, wenn previewState
// zwischenzeitlich (z. B. beim Unmount) schon veraendert wurde.
let streamActive = false
// tickets/141/141.txt-Lehre (siehe IMPLEMENTATION_PLAN.md): schuetzt vor
// Kamerazugriffen nach dem Verlassen der Seite waehrend eines noch
// laufenden start()/stop().
let isComponentMounted = true
// Serialisiert schnelles Umschalten zwischen Kameras (IMPLEMENTATION_PLAN.md,
// "Risiken") - jeder switchPreview()-Aufruf haengt sich an die bestehende
// Kette an, sodass nie zwei start()/stop() parallel auf demselben
// Html5Qrcode-Objekt laufen.
let switchQueue = Promise.resolve()

const previewState = ref('idle') // 'idle' | 'starting' | 'active' | 'error'
const previewError = ref('')

const startPreview = async (cameraId) => {
  previewState.value = 'starting'
  previewError.value = ''
  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('qr-settings-preview')
    }
    // Erfolgreicher Scan in der Vorschau loest bewusst keine Aktion aus
    // (152.txt, Punkt 4) - beide Decode-Callbacks sind No-ops.
    await html5QrCode.start(cameraId, PREVIEW_CONFIG, () => {}, () => {})
    streamActive = true
    if (!isComponentMounted) {
      await stopPreview()
      return
    }
    previewState.value = 'active'
  } catch (error) {
    console.error('❌ Fehler beim Starten der Kamera-Vorschau:', error)
    if (isComponentMounted) {
      previewError.value = 'Fehler beim Zugriff auf die Kamera. Bitte Berechtigungen prüfen.'
      previewState.value = 'error'
    }
  }
}

const stopPreview = async () => {
  if (html5QrCode && streamActive) {
    try {
      await html5QrCode.stop()
    } catch (error) {
      console.warn('⚠️ Fehler beim Stoppen der Kamera-Vorschau:', error)
    } finally {
      streamActive = false
    }
  }
}

const switchPreview = (cameraId) => {
  switchQueue = switchQueue.then(async () => {
    if (!isComponentMounted) {
      return
    }
    await stopPreview()
    if (!isComponentMounted) {
      return
    }
    if (cameraId === null) {
      previewState.value = 'idle'
      previewError.value = ''
      return
    }
    await startPreview(cameraId)
  })
  return switchQueue
}

// "Automatische Kamerawahl" zeigt bewusst keine Vorschau (IMPLEMENTATION_PLAN.md,
// "UI изменения") - der Modus ist nicht an ein konkretes Geraet aus
// settings.cameraList gebunden, Scanner.vue entscheidet das erst beim
// tatsaechlichen Scan-Start per facingMode-Heuristik.
watch(
    () => [settings.preferredCameraId.value, settings.cameraList.value],
    ([cameraId, list]) => {
      if (cameraId === null) {
        switchPreview(null)
        return
      }
      // Vorschau fuer eine gespeicherte Kamera erst starten, wenn die Liste
      // geladen ist und das Geraet dort noch existiert (wie
      // preferredCameraStillExists in Scanner.vue) - sonst bleibt die
      // Vorschau im idle/error-Zustand, ohne preferredCameraId zurueckzusetzen.
      if (list.some(device => device.id === cameraId)) {
        switchPreview(cameraId)
      }
    },
    { immediate: true }
)

onMounted(() => {
  loadCameras()
})

onBeforeUnmount(async () => {
  isComponentMounted = false
  await stopPreview()
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

.preview-square {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #000;
  overflow: hidden;
  border-radius: 8px;
}

#qr-settings-preview {
  width: 100%;
  height: 100%;
}

/* html5-qrcode erzeugt video/canvas dynamisch (kein vom Compiler erfasstes
   Scoped-Markup) - hier wie in Scanner.vue auf volle Flaeche des quadratischen
   Containers erzwungen. */
#qr-settings-preview :deep(video),
#qr-settings-preview :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px;
  color: white;
  background: rgba(0, 0, 0, 0.85);
}
</style>
