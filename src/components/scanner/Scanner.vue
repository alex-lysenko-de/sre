<!-- src/components/scanner/Scanner.vue -->
<!-- Wiederverwendbarer Basis-Scanner fuer den Prototyp aus Ticket 116. -->
<!-- Kamera, Decode, Bracelet-Resolve, Grundfeedback (Ton/Vibration/Bestaetigungsbildschirm). -->
<!-- Kennt keine Modi (Bus/Gruppe/Checkin, siehe Ticket 120) - liefert nur das Resolve-Ergebnis
     ueber den Pflicht-Callback-Prop onChildResolved nach oben. -->
<!-- Kamera-Einstellungen (bevorzugte Kamera, Anzeigedauern) sind seit Ticket 126
     in useScannerSettings.js ausgelagert - siehe tickets/126/126.txt Punkt 4. -->

<template>
  <div class="proto-scanner">
    <div class="proto-scan-area">
      <div id="qr-reader-proto"></div>

      <div v-if="isTransitioning && !confirmation.show" class="proto-scanner-overlay">
        <div class="spinner-border text-light" role="status"></div>
        <p>Scanner wird initialisiert...</p>
      </div>

      <div v-if="!scannerActive && !isTransitioning && !confirmation.show" class="proto-scanner-off">
        <button class="btn btn-primary proto-scan-btn" @click="startCamera">
          <font-awesome-icon :icon="['fas', 'qrcode']" size="2x" class="mb-2"/>
          <div>Scan</div>
        </button>
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

        <div v-if="confirmation.persistent" class="proto-confirmation-actions">
          <button class="btn btn-outline-light" @click="handleConfirmationCancel">
            Abbrechen
          </button>
          <button class="btn btn-warning fw-bold" @click="handleConfirmationBind">
            Armband zuordnen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { useArmband } from '@/composables/useArmband'
import { useConfigStore } from '@/stores/config.js'
import { useScannerFeedback } from '@/composables/useScannerFeedback'
import { useScannerSettings } from '@/composables/useScannerSettings'

const props = defineProps({
  // Pflicht-Callback: async (result) => ({ title, subtitle, variant?, repeat? })
  // result ist { status: 'invalid' } | { status: 'error', bandId } | { status: 'not-found', bandId } | { status: 'found', child, bandId }
  onChildResolved: {
    type: Function,
    required: true
  },
  // Wenn false, wird die Kamera nicht automatisch beim Mounten gestartet -
  // stattdessen erscheint sofort der Scan-Button (siehe unten). Fuer die
  // eingebettete Kopfzaehlung-Panel (tickets/126/126.txt Punkt 5), deren
  // Bereich immer sichtbar bleiben soll, aber nicht immer die Kamera laufen
  // lassen darf.
  autoStart: {
    type: Boolean,
    default: true
  },
  // Optional: async/sync (bandId) => void. Wenn gesetzt, zeigt der Status
  // 'not-found' einen persistenten Bildschirm mit Cancel/"Привязать бейдж"
  // statt des automatisch schliessenden Standardbildschirms (tickets/126/126.txt
  // Punkt 7). "Привязать бейдж" ruft diesen Callback auf und setzt das
  // Scannen NICHT selbst fort - das ist Sache der aufrufenden Seite (Navigation
  // weg von diesem Bildschirm oder expliziter stop()-Aufruf).
  onBindRequested: {
    type: Function,
    default: null
  }
})

// Fuer Aufrufer, die die Kamera nicht selbst ueber start()/stop() ansteuern,
// sondern nur ihren eigenen Zustand synchron halten wollen (Kopfzaehlung,
// tickets/126/126.txt Punkt 5: Paketaufbau soll bei jedem Kamerastart neu
// beginnen) - Scanner.vue kennt dabei weiterhin keine Modi, meldet nur den
// eigenen Kamerazustand nach oben.
const emit = defineEmits(['camera-started', 'camera-stopped'])

const armband = useArmband()
const configStore = useConfigStore()
const feedback = useScannerFeedback()
const settings = useScannerSettings()

let html5QrCode = null

const SCANNER_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0
}

const scannerActive = ref(false)
// Muss mit false starten: startCamera() selbst prueft isTransitioning als
// Guard gegen doppelte parallele Starts - waere der Initialwert bereits true
// (z. B. gespiegelt von autoStart), wuerde der allererste Aufruf aus
// onMounted() sich selbst blockieren, bevor die Kamera je angefragt wird
// (siehe tickets/126/REVIEW_REPORT.md, Critical 1).
const isTransitioning = ref(false)
// Sperrt neue Scans, waehrend der letzte Scan noch verarbeitet/angezeigt wird.
const isProcessing = ref(false)

const confirmation = reactive({
  show: false,
  variant: 'success',
  title: '',
  subtitle: '',
  repeat: false,
  persistent: false,
  bandId: null
})

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

const durationFor = (variant) => variant === 'success' ? settings.successDurationMs.value : settings.errorDurationMs.value

// ============================================
// KAMERA-STEUERUNG
// ============================================
const startScanningWithDeviceId = async (deviceId) => {
  await html5QrCode.start(deviceId, SCANNER_CONFIG, onScanSuccess, onScanError)
  scannerActive.value = true
  emit('camera-started')
}

const startScanningWithDeviceListFallback = async () => {
  if (!settings.cameraList.value || settings.cameraList.value.length === 0) {
    try {
      await settings.loadCameraList()
    } catch (accessError) {
      console.error('❌ Kein Zugriff auf die Kamera:', accessError)
      alert('Kein Zugriff auf die Kamera. Bitte Berechtigungen prüfen.')
      return
    }
  }
  if (!settings.cameraList.value || settings.cameraList.value.length === 0) {
    alert('Keine Kamera gefunden!')
    return
  }
  const backCamera = settings.cameraList.value.find(device =>
      device.label.toLowerCase().includes('back') ||
      device.label.toLowerCase().includes('rear') ||
      device.label.includes('0')
  ) || settings.cameraList.value[0]
  await startScanningWithDeviceId(backCamera.id)
}

const startScanningWithFacingMode = async () => {
  try {
    await html5QrCode.start({ facingMode: { exact: 'environment' } }, SCANNER_CONFIG, onScanSuccess, onScanError)
    scannerActive.value = true
    emit('camera-started')
  } catch (exactError) {
    console.warn('⚠️ facingMode { exact: "environment" } fehlgeschlagen:', exactError)
    try {
      await html5QrCode.start({ facingMode: 'environment' }, SCANNER_CONFIG, onScanSuccess, onScanError)
      scannerActive.value = true
      emit('camera-started')
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
      emit('camera-stopped')
    }
  }
}

// Startet die Kamera - sowohl beim automatischen Start (autoStart, onMounted)
// als auch ueber den manuellen Scan-Button/expose start() (tickets/126/126.txt
// Punkt 5). Liest die bevorzugte Kamera aus useScannerSettings statt sie
// selbst zu verwalten.
const startCamera = async () => {
  if (scannerActive.value || isTransitioning.value) {
    return
  }
  isTransitioning.value = true
  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('qr-reader-proto')
    }
    await configStore.loadConfig()

    if (!settings.cameraList.value || settings.cameraList.value.length === 0) {
      try {
        await settings.loadCameraList()
      } catch (listError) {
        console.warn('⚠️ Kameraliste konnte nicht geladen werden:', listError)
      }
    }

    const preferredCameraId = settings.preferredCameraId.value
    const preferredCameraStillExists = preferredCameraId &&
        settings.cameraList.value.some(device => device.id === preferredCameraId)

    if (preferredCameraStillExists) {
      await startScanningWithDeviceId(preferredCameraId)
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

const showConfirmationScreen = (variant, display, persistent = false, bandId = null) => {
  confirmation.variant = variant
  confirmation.title = display.title
  confirmation.subtitle = display.subtitle || ''
  confirmation.repeat = !!display.repeat
  confirmation.persistent = persistent
  confirmation.bandId = bandId
  confirmation.show = true
}

const hideConfirmationScreen = () => {
  confirmation.show = false
  confirmation.persistent = false
  confirmation.bandId = null
}

const resumeAfterConfirmation = () => {
  hideConfirmationScreen()
  try {
    html5QrCode.resume()
  } catch (error) {
    console.warn('⚠️ Fehler beim Fortsetzen des Scanners:', error)
  }
  isProcessing.value = false
}

// Nicht-verbundenes Armband: Meldung bleibt stehen, bis der Nutzer Cancel
// oder "Привязать бейдж" waehlt (tickets/126/126.txt Punkt 7) - kein Auto-Hide.
const handleConfirmationCancel = () => {
  resumeAfterConfirmation()
}

const handleConfirmationBind = () => {
  const bandId = confirmation.bandId
  hideConfirmationScreen()
  isProcessing.value = false
  try {
    props.onBindRequested?.(bandId)
  } catch (error) {
    console.error('❌ Fehler in onBindRequested:', error)
  }
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

  // Persistenter Zweig fuer nicht-verbundenes Armband (Punkt 7): Bildschirm
  // bleibt stehen, bis der Nutzer Cancel/"Привязать бейдж" waehlt - kein
  // automatisches Fortsetzen. Nur aktiv, wenn die aufrufende Seite
  // onBindRequested uebergeben hat (z. B. nicht in HeadcountView.vue).
  if (result.status === 'not-found' && props.onBindRequested) {
    showConfirmationScreen(variant, display, true, result.bandId)
    return
  }

  showConfirmationScreen(variant, display)
  await wait(durationFor(variant))
  resumeAfterConfirmation()
}

const onScanError = () => {
  // Ignorieren - normal beim Scannen.
}

// Fuer extern ausgeloeste Meldungen (z. B. Ergebnis von "Senden" in
// ScannerPrototypeView.vue), die denselben Bestaetigungsbildschirm wie ein
// Scan-Ereignis wiederverwenden sollen, ohne selbst ein Scan-Ereignis zu sein.
//
// Am Ende bewusst kein html5QrCode.resume(): resume() haengt vom nativen
// <video>-Event "playing" ab (html5-qrcode/esm/camera/core-impl.js,
// RenderedCameraImpl.prototype.resume), das bei ueberlappenden
// pause()/play()-Aufrufen auf demselben <video>-Element (z. B. wenn dieser
// Zyklus mit dem Scan-Bestaetigungszyklus in onScanSuccess/
// resumeAfterConfirmation kollidiert) nachweislich nicht immer feuert - ohne
// Exception oder rejected Promise. Der interne FSM von html5-qrcode bleibt
// dann fuer immer in PAUSED haengen: Kamerabild laeuft weiter, Decode ist
// aber dauerhaft aus (tickets/141/141.txt). Ein try/catch um resume() kann
// das nicht erkennen. Stattdessen: garantierter Kaltstart ueber
// stopScanning()/startCamera() - denselben, bereits als zuverlaessig
// getesteten Pfad wie beim ersten Oeffnen des Scanners (tickets/141/
// IMPLEMENTATION_PLAN.md).
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
  await wait(durationMs || durationFor(variant))
  hideConfirmationScreen()

  if (wasActive) {
    await stopScanning()
    await startCamera()
  }
}

// ============================================
// LIFECYCLE
// ============================================
onMounted(() => {
  window.addEventListener('touchend', feedback.unlockAudioContext, { once: true })
  window.addEventListener('click', feedback.unlockAudioContext, { once: true })
  if (props.autoStart) {
    startCamera()
  }
})

onBeforeUnmount(async () => {
  window.removeEventListener('touchend', feedback.unlockAudioContext)
  window.removeEventListener('click', feedback.unlockAudioContext)
  feedback.closeAudioContext()
  await stopScanning()
})

// start() wird von keinem aktuellen Aufrufer verwendet - HeadcountView.vue
// startet die Kamera ueber den eingebauten Scan-Button (siehe oben), nicht
// per scannerRef.value.start(); stop() wird dagegen von closePanel() in
// useGroupScanSession.js verwendet. start() bleibt trotzdem oeffentlich, als
// symmetrisches Gegenstueck zu stop() fuer kuenftige Aufrufer, die die Kamera
// programmatisch statt per Klick starten wollen (tickets/126/REVIEW_REPORT.md,
// Minor 2).
defineExpose({ start: startCamera, stop: stopScanning, showMessage: showExternalMessage })
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

.proto-scanner-off {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.proto-scan-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  font-size: 1.2rem;
  font-weight: 700;
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

.proto-confirmation-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
</style>
