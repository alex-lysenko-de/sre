<!-- src/components/scanner/Scanner.vue -->
<!-- Wiederverwendbarer Basis-Scanner fuer den Prototyp aus Ticket 116. -->
<!-- Kamera, Decode, Bracelet-Resolve, Grundfeedback (Ton/Vibration/Bestaetigungsbildschirm). -->
<!-- Kennt keine Modi (Bus/Gruppe/Checkin, siehe Ticket 120) - liefert nur das Resolve-Ergebnis
     ueber den Pflicht-Callback-Prop onChildResolved nach oben. -->

<template>
  <div class="proto-scanner">
    <div class="proto-scan-area">
      <div id="qr-reader-proto"></div>

      <div v-if="!scannerActive && !confirmation.show" class="proto-scanner-overlay">
        <div class="spinner-border text-light" role="status"></div>
        <p>Scanner wird initialisiert...</p>
      </div>

      <div v-if="confirmation.show" class="proto-confirmation" :class="confirmation.variant">
        <div class="proto-confirmation-icons">
          <font-awesome-icon
              :icon="['fas', confirmation.variant === 'success' ? 'check-circle' : 'times']"
              class="proto-confirmation-icon"
          />
          <font-awesome-icon
              v-if="confirmation.repeat"
              :icon="['fas', 'check-circle']"
              class="proto-confirmation-icon proto-confirmation-icon-repeat"
          />
        </div>
        <div class="proto-confirmation-title">{{ confirmation.title }}</div>
        <div v-if="confirmation.subtitle" class="proto-confirmation-subtitle">{{ confirmation.subtitle }}</div>
      </div>
    </div>

    <div class="proto-scanner-controls">
      <button
          class="btn btn-warning proto-camera-picker-btn"
          :disabled="controlsDisabled"
          @click="showCameraSelector = !showCameraSelector"
      >
        Kamera: {{ currentCameraLabel }}
      </button>

      <ul v-if="showCameraSelector" class="proto-camera-list">
        <li>
          <button
              class="proto-camera-list-item"
              :class="{ active: currentCameraId === null }"
              :disabled="controlsDisabled"
              @click="chooseCamera(null)"
          >
            Automatische Kamerawahl
          </button>
        </li>
        <li v-for="cam in cameraList" :key="cam.id">
          <button
              class="proto-camera-list-item"
              :class="{ active: currentCameraId === cam.id }"
              :disabled="controlsDisabled"
              @click="chooseCamera(cam.id)"
          >
            {{ cam.label || cam.id }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { useArmband } from '@/composables/useArmband'
import { useConfigStore } from '@/stores/config.js'
import { useScannerFeedback } from '@/composables/useScannerFeedback'

const props = defineProps({
  // Pflicht-Callback: async (result) => ({ title, subtitle, variant?, repeat? })
  // result ist { status: 'invalid' } | { status: 'error', bandId } | { status: 'not-found', bandId } | { status: 'found', child, bandId }
  onChildResolved: {
    type: Function,
    required: true
  }
})

const armband = useArmband()
const configStore = useConfigStore()
const feedback = useScannerFeedback()

let html5QrCode = null

// Gleicher Schluessel wie ScannerView.vue - die bevorzugte Kamera ist eine
// Geraete-Praeferenz, kein View-spezifischer Zustand, daher gemeinsam nutzbar.
const CAMERA_STORAGE_KEY = 'scanner_preferred_camera_id'

const SCANNER_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0
}

const cameraList = ref([])
const currentCameraId = ref(null) // null = automatischer Modus (facingMode)
const showCameraSelector = ref(false)
const scannerActive = ref(false)
// Sperrt Kamera-Steuerelemente waehrend eines html5QrCode.start()/stop()-Uebergangs.
const isTransitioning = ref(false)
// Sperrt neue Scans, waehrend der letzte Scan noch verarbeitet/angezeigt wird.
const isProcessing = ref(false)

const controlsDisabled = computed(() => isTransitioning.value || isProcessing.value)

const currentCameraLabel = computed(() => {
  if (currentCameraId.value === null) {
    return 'Automatisch (Rückkamera)'
  }
  const cam = cameraList.value.find(c => c.id === currentCameraId.value)
  return cam ? (cam.label || cam.id) : currentCameraId.value
})

const confirmation = reactive({
  show: false,
  variant: 'success',
  title: '',
  subtitle: '',
  repeat: false
})

// Anzeigedauer des Bestaetigungsbildschirms - laut manuellem Test auf echten
// Geraeten war eine einzige Konstante (0.8s) fuer beide Ergebnisarten zu kurz,
// besonders um Fehlertexte zu lesen.
const CONFIRMATION_DURATION_MS = {
  success: 1600,
  error: 3000
}

// ============================================
// QR-Code Format (wie ScannerView.vue, unabhaengig neu implementiert)
// ============================================
const getBaseDomain = () => {
  if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    return configStore.baseUrl || 'http://localhost'
  }
  return window.location.origin
}

const createQrCodePattern = () => {
  const domain = getBaseDomain()
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedDomain}\\/?\\?id=(\\d{1,3})$`)
}

// ============================================
// Signale (Frequenzen/Muster sind Sache dieses Aufrufers, nicht des Composables)
// ============================================
const SOUND = {
  scan: { frequencies: [660], duration: 0.08 },
  invalid: { frequencies: [220], duration: 0.3 },
  notFound: { frequencies: [220, 180], duration: 0.25 },
  // Eigener Ton fuer Infrastruktur-/Netzwerkfehler - hoerbar unterscheidbar von
  // "Armband wirklich nicht zugeordnet" (notFound).
  error: { frequencies: [220, 220, 220], duration: 0.18 },
  success: { frequencies: [880, 1318.51], duration: 0.12 }
}
const VIBRATION_SHORT = [80]
const VIBRATION_LONG = [300]

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ============================================
// KAMERA-STEUERUNG
// ============================================
const startScanningWithDeviceId = async (deviceId) => {
  await html5QrCode.start(deviceId, SCANNER_CONFIG, onScanSuccess, onScanError)
  scannerActive.value = true
  currentCameraId.value = deviceId
}

const startScanningWithDeviceListFallback = async () => {
  if (!cameraList.value || cameraList.value.length === 0) {
    try {
      cameraList.value = await Html5Qrcode.getCameras()
    } catch (accessError) {
      console.error('❌ Kein Zugriff auf die Kamera:', accessError)
      alert('Kein Zugriff auf die Kamera. Bitte Berechtigungen prüfen.')
      return
    }
  }
  if (!cameraList.value || cameraList.value.length === 0) {
    alert('Keine Kamera gefunden!')
    return
  }
  const backCamera = cameraList.value.find(device =>
      device.label.toLowerCase().includes('back') ||
      device.label.toLowerCase().includes('rear') ||
      device.label.includes('0')
  ) || cameraList.value[0]
  await startScanningWithDeviceId(backCamera.id)
}

const startScanningWithFacingMode = async () => {
  try {
    await html5QrCode.start({ facingMode: { exact: 'environment' } }, SCANNER_CONFIG, onScanSuccess, onScanError)
    scannerActive.value = true
    currentCameraId.value = null
  } catch (exactError) {
    console.warn('⚠️ facingMode { exact: "environment" } fehlgeschlagen:', exactError)
    try {
      await html5QrCode.start({ facingMode: 'environment' }, SCANNER_CONFIG, onScanSuccess, onScanError)
      scannerActive.value = true
      currentCameraId.value = null
    } catch (nonExactError) {
      console.warn('⚠️ facingMode "environment" fehlgeschlagen, Fallback auf Geräteliste:', nonExactError)
      await startScanningWithDeviceListFallback()
    }
  }
}

const stopScanning = async () => {
  if (html5QrCode && scannerActive.value) {
    try {
      await html5QrCode.stop()
    } catch (error) {
      console.warn('⚠️ Fehler beim Stoppen des Scanners:', error)
    } finally {
      scannerActive.value = false
    }
  }
}

// Einheitliche Kamerawahl: deviceId einer konkreten Kamera oder null fuer den
// automatischen Modus (facingMode) - beide Faelle sind gleichwertige Eintraege
// derselben Liste (Ergebnis der manuellen UX-Tests, siehe REVIEW_REPORT.md).
const chooseCamera = async (deviceId) => {
  if (controlsDisabled.value) {
    return
  }
  if (deviceId === currentCameraId.value) {
    showCameraSelector.value = false
    return
  }
  isTransitioning.value = true
  try {
    await stopScanning()
    if (deviceId === null) {
      await startScanningWithFacingMode()
      localStorage.removeItem(CAMERA_STORAGE_KEY)
    } else {
      await startScanningWithDeviceId(deviceId)
      localStorage.setItem(CAMERA_STORAGE_KEY, deviceId)
    }
    showCameraSelector.value = false
  } catch (error) {
    console.error('❌ Fehler beim Wechseln der Kamera:', error)
    alert('Fehler beim Wechseln der Kamera.')
  } finally {
    isTransitioning.value = false
  }
}

const initScanner = async () => {
  isTransitioning.value = true
  try {
    html5QrCode = new Html5Qrcode('qr-reader-proto')
    await configStore.loadConfig()

    try {
      cameraList.value = await Html5Qrcode.getCameras()
    } catch (listError) {
      console.warn('⚠️ Kameraliste konnte nicht geladen werden:', listError)
    }

    const savedCameraId = localStorage.getItem(CAMERA_STORAGE_KEY)
    const savedCameraStillExists = savedCameraId && cameraList.value.some(device => device.id === savedCameraId)

    if (savedCameraStillExists) {
      await startScanningWithDeviceId(savedCameraId)
    } else {
      await startScanningWithFacingMode()
    }
  } catch (error) {
    console.error('❌ Fehler beim Starten des Scanners:', error)
    alert('Fehler beim Zugriff auf die Kamera. Bitte Berechtigungen prüfen.')
  } finally {
    isTransitioning.value = false
  }
}

// ============================================
// SCAN-VERARBEITUNG (industrielles Verhalten, 116.txt Punkt 4-6)
// ============================================
const defaultDisplayFor = (result) => {
  if (result.status === 'invalid') {
    return { title: 'Ungültiger QR-Code' }
  }
  if (result.status === 'error') {
    return { title: 'Fehler beim Prüfen des Armbands', subtitle: 'Bitte erneut versuchen' }
  }
  if (result.status === 'not-found') {
    return { title: 'Kein Kind mit dem Verband verbunden' }
  }
  return { title: result.child.name, subtitle: `Gruppe ${result.child.group_id}` }
}

const showConfirmationScreen = (variant, display) => {
  confirmation.variant = variant
  confirmation.title = display.title
  confirmation.subtitle = display.subtitle || ''
  confirmation.repeat = !!display.repeat
  confirmation.show = true
}

const hideConfirmationScreen = () => {
  confirmation.show = false
}

const onScanSuccess = async (decodedText) => {
  if (isProcessing.value) {
    return
  }
  isProcessing.value = true

  try {
    await html5QrCode.pause(true)
  } catch (error) {
    console.warn('⚠️ Fehler beim Pausieren des Scanners:', error)
  }

  // Der reine erfolgreiche Decode wird unabhaengig vom weiteren Ergebnis quittiert
  // (116.txt Punkt 4: "звуковой сигнал независимо от дальнейшей бизнес-логики").
  feedback.playTone(SOUND.scan.frequencies, SOUND.scan.duration)
  feedback.vibrate(VIBRATION_SHORT)

  let result
  const qrPattern = createQrCodePattern()
  const match = decodedText.match(qrPattern)

  if (!match) {
    result = { status: 'invalid' }
    feedback.playTone(SOUND.invalid.frequencies, SOUND.invalid.duration)
    feedback.vibrate(VIBRATION_LONG)
  } else {
    const bandId = match[1]
    let child = null
    let fetchFailed = false
    try {
      child = await armband.getBraceletStatus(bandId)
    } catch (error) {
      console.error('❌ Fehler beim Abrufen des Armband-Status:', error)
      fetchFailed = true
    }

    if (fetchFailed) {
      // Netzwerk-/Serverfehler darf nicht als "Armband nicht zugeordnet"
      // erscheinen - das waere in der Praesenzerfassung ein falscher Befund.
      result = { status: 'error', bandId }
      feedback.playTone(SOUND.error.frequencies, SOUND.error.duration)
      feedback.vibrate(VIBRATION_LONG)
    } else if (!child) {
      result = { status: 'not-found', bandId }
      feedback.playTone(SOUND.notFound.frequencies, SOUND.notFound.duration)
      feedback.vibrate(VIBRATION_LONG)
    } else {
      result = { status: 'found', child, bandId }
      feedback.playTone(SOUND.success.frequencies, SOUND.success.duration)
      // Kurze Vibration ist beim rohen Decode bereits ausgeloest worden.
    }
  }

  const defaults = defaultDisplayFor(result)
  let display = defaults
  try {
    const override = await props.onChildResolved(result)
    if (override) {
      display = { ...defaults, ...override }
    }
  } catch (error) {
    console.error('❌ Fehler in onChildResolved:', error)
  }

  const variant = display.variant || (result.status === 'found' ? 'success' : 'error')
  showConfirmationScreen(variant, display)

  await wait(CONFIRMATION_DURATION_MS[variant])
  hideConfirmationScreen()

  try {
    html5QrCode.resume()
  } catch (error) {
    console.warn('⚠️ Fehler beim Fortsetzen des Scanners:', error)
  }

  isProcessing.value = false
}

const onScanError = () => {
  // Ignorieren - normal beim Scannen.
}

// Fuer extern ausgeloeste Meldungen (z. B. Ergebnis von "Senden" in
// ScannerPrototypeView.vue), die denselben Bestaetigungsbildschirm wie ein
// Scan-Ergebnis wiederverwenden sollen, ohne selbst ein Scan-Ereignis zu sein.
const showExternalMessage = async (variant, display, durationMs) => {
  const wasActive = scannerActive.value
  if (wasActive) {
    try {
      await html5QrCode.pause(true)
    } catch (error) {
      console.warn('⚠️ Fehler beim Pausieren des Scanners:', error)
    }
  }

  showConfirmationScreen(variant, display)
  await wait(durationMs || CONFIRMATION_DURATION_MS[variant] || CONFIRMATION_DURATION_MS.success)
  hideConfirmationScreen()

  if (wasActive) {
    try {
      html5QrCode.resume()
    } catch (error) {
      console.warn('⚠️ Fehler beim Fortsetzen des Scanners:', error)
    }
  }
}

// ============================================
// LIFECYCLE
// ============================================
onMounted(() => {
  window.addEventListener('touchend', feedback.unlockAudioContext, { once: true })
  window.addEventListener('click', feedback.unlockAudioContext, { once: true })
  initScanner()
})

onBeforeUnmount(async () => {
  window.removeEventListener('touchend', feedback.unlockAudioContext)
  window.removeEventListener('click', feedback.unlockAudioContext)
  feedback.closeAudioContext()
  await stopScanning()
})

defineExpose({ stop: stopScanning, showMessage: showExternalMessage })
</script>

<style scoped>
.proto-scanner {
  display: flex;
  flex-direction: column;
}

.proto-scan-area {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  flex: 0 0 auto;
  background: #000;
  overflow: hidden;
}

#qr-reader-proto {
  width: 100%;
  height: 100%;
}

/* html5-qrcode erzeugt video/canvas dynamisch (kein vom Compiler erfasstes
   Scoped-Markup) und setzt teils eigene Inline-Groessen - hier erzwungen auf
   volle Flaeche des quadratischen Containers, damit kein schwarzer Rand bleibt. */
#qr-reader-proto :deep(video),
#qr-reader-proto :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

.proto-scanner-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  color: white;
}

.proto-confirmation {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
}

.proto-confirmation.success {
  background: #28a745;
  color: white;
}

.proto-confirmation.error {
  background: #dc3545;
  color: white;
}

.proto-confirmation-icons {
  display: flex;
  gap: 8px;
}

.proto-confirmation-icon {
  font-size: 4rem;
}

.proto-confirmation-icon-repeat {
  font-size: 2.5rem;
  align-self: flex-end;
  opacity: 0.85;
}

.proto-confirmation-title {
  font-size: 1.6rem;
  font-weight: 700;
}

.proto-confirmation-subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
}

.proto-scanner-controls {
  flex: 0 0 auto;
  background: #212529;
  color: white;
  padding: 12px 15px;
}

.proto-camera-picker-btn {
  width: 100%;
  padding: 14px 18px;
  font-weight: 600;
}

.proto-camera-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.proto-camera-list-item {
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
}

.proto-camera-list-item:last-child {
  border-bottom: none;
}

.proto-camera-list-item.active {
  background: rgba(40, 167, 69, 0.4);
  font-weight: 700;
}
</style>
