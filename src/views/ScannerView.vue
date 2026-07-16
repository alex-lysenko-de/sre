// src/views/ScannerView.vue
// TODO: Make the scanner view reusable. Main idea is to use it for different scanning tasks in the future.
// it could be used for preparing a list of children in a bus or for checking attendance or for speed assignment of bracelets to children.

<template>
  <div class="scanner-view">
    <!-- Compact Header -->
    <div class="scanner-header">
      <div class="status-badge" :class="scannerActive ? 'active' : 'inactive'">
        <i class="fas fa-circle pulse-icon"></i>
        {{ scannerActive ? 'Scanner aktiv' : 'Gestoppt' }}
      </div>
      <div class="header-actions">
        <button
            @click="showCameraSelector = !showCameraSelector"
            class="btn btn-secondary btn-camera"
            title="Kamera wechseln"
        >
          <i class="fas fa-camera"></i>
        </button>
        <button @click="exitScanner" class="btn btn-danger btn-exit">
          <i class="fas fa-times"></i> Beenden
        </button>
      </div>
    </div>

    <!-- Manual Camera Selector -->
    <div v-if="showCameraSelector" class="camera-selector">
      <label class="camera-selector-label" for="camera-select">Kamera auswählen:</label>
      <select
          id="camera-select"
          class="form-select"
          :value="currentCameraId"
          @change="selectCamera($event.target.value)"
      >
        <option v-for="cam in cameraList" :key="cam.id" :value="cam.id">
          {{ cam.label || cam.id }}
        </option>
      </select>
    </div>

    <!-- Counter Bar -->
    <div class="counter-bar">
      <span>Gescannte Codes: <strong>{{ scannedChildren.length }}</strong></span>
    </div>

    <!-- Scanner Container with Flash Effect -->
    <div class="scanner-container" :class="{ 'flash-success': showFlash }">
      <div id="qr-reader" ref="qrReader"></div>
      <div v-if="!scannerActive" class="scanner-overlay">
        <div class="spinner-border text-light" role="status"></div>
        <p>Scanner wird initialisiert...</p>
      </div>
    </div>

    <!-- Current Child Info Display -->
    <div v-if="lastScannedChild" class="last-scanned">
      <div class="alert alert-success mb-0">
        <i class="fas fa-check-circle"></i>
        <div class="child-info">
          <strong>{{ lastScannedChild.name }}</strong>
          <span class="badge bg-primary ms-2">Gruppe {{ lastScannedChild.group_id }}</span>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="lastError" class="last-error">
      <div class="alert alert-danger mb-0">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ lastError }}</span>
      </div>
    </div>

    <!-- Scanned Children List -->
    <div v-if="scannedChildren.length > 0" class="scanned-list">
      <h5>Gescannte Kinder ({{ scannedChildren.length }}):</h5>
      <div class="children-container">
        <div
            v-for="(child, index) in scannedChildren"
            :key="index"
            class="child-item"
        >
          <span class="child-number">{{ index + 1 }}.</span>
          <div class="child-details">
            <span class="child-name">{{ child.name }}</span>
            <span class="badge bg-primary">Gruppe {{ child.group_id }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted, onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {Html5Qrcode} from 'html5-qrcode'
import {useArmband} from '@/composables/useArmband'
import {useUserStore} from '@/stores/user'
import {useConfigStore} from "@/stores/config.js"

const router = useRouter()
const armbandComposable = useArmband()
const configStore = useConfigStore()
const userStore = useUserStore()

// ============================================
// STATE
// ============================================
const qrReader = ref(null)
const scannedChildren = ref([])
const lastScannedChild = ref(null)
const lastError = ref('')
const scannerActive = ref(false)
const showFlash = ref(false)
let html5QrCode = null

// ============================================
// СИСТЕМА ОЧЕРЕДИ ДЛЯ ПРЕДОТВРАЩЕНИЯ ДУБЛИКАТОВ
// ============================================
const scannedUrls = new Set() // Набор уже отсканированных URL
const processingQueue = [] // Очередь на обработку
let isProcessingQueue = false // Флаг обработки очереди

// Auswahl der Kamera
const CAMERA_STORAGE_KEY = 'scanner_preferred_camera_id'
const cameraList = ref([]) // Liste aller verfügbaren Kameras (id + label)
const currentCameraId = ref(null) // deviceId der aktuell aktiven Kamera (null bei facingMode-Start)
const showCameraSelector = ref(false)

// Конфигурация сканера
const SCANNER_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0
}

// ============================================
// AUDIO
// ============================================
// Web Audio API statt Audio-Dateien: volle Kontrolle ueber Lautstaerke/Dauer,
// unabhaengig von der Mastering-Qualitaet eines eingebetteten Sounds.
// Hinweis: Auf iOS Safari bleibt der Ton bei aktiviertem Stummschalter
// (mute switch) trotzdem stumm - eine Plattform-Einschraenkung von Safari
// fuer Web-Audio, die sich clientseitig nicht umgehen laesst.
let audioContext = null
const getAudioContext = () => {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext = new AudioContextClass()
  }
  return audioContext
}

const playTone = (frequencies, toneDuration) => {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  const now = ctx.currentTime
  frequencies.forEach((freq, index) => {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq
    const startTime = now + index * toneDuration
    gainNode.gain.setValueAtTime(0.9, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + toneDuration)
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + toneDuration)
  })
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get base domain from window.location
const getBaseDomain = () => {
  if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    const configDomain = configStore.config.base_url
    if (configDomain) {
      return configDomain
    } else {
      console.warn('⚠️ Keine Basisdomain in der Konfiguration gefunden, verwende localhost')
      return 'http://localhost'
    }
  } else {
    return window.location.origin
  }
}

// QR-Code Regex Pattern
const createQrCodePattern = () => {
  const domain = getBaseDomain()
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedDomain}\\/?\\?id=(\\d{1,3})$`)
}

// Sound abspielen
const playSound = (type) => {
  try {
    if (type === 'success') {
      playTone([880, 1318.51], 0.12) // kurzer, deutlich hörbarer Doppel-Beep
    } else {
      playTone([220], 0.35) // tiefer, langer Ton für Fehler
    }
  } catch (error) {
    console.warn('Sound konnte nicht abgespielt werden:', error)
  }
}

// Vibration triggern (PWA)
const triggerVibration = () => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([150, 50, 150, 50, 150]) // Vibration pattern (verstärkt)
    }
  } catch (error) {
    console.warn('Vibration nicht unterstützt:', error)
  }
}

// Flash-Effekt
const triggerFlashEffect = () => {
  showFlash.value = true
  setTimeout(() => {
    showFlash.value = false
  }, 1000)
}

// ============================================
// SCANNER MANAGEMENT
// ============================================

// Start via deviceId (manuelle Auswahl, gespeicherte Kamera, Fallback über Geräteliste)
const startScanningWithDeviceId = async (deviceId) => {
  await html5QrCode.start(
      deviceId,
      SCANNER_CONFIG,
      onScanSuccess,
      onScanError
  )
  scannerActive.value = true
  currentCameraId.value = deviceId
  console.log('✅ Scanner has started (deviceId):', deviceId)
}

// Fallback: Kamera anhand des Labels aus der Geräteliste raten (altes Verhalten,
// nur noch als letzte Stufe, falls facingMode nicht unterstützt wird).
const startScanningWithDeviceListFallback = async () => {
  if (!cameraList.value || cameraList.value.length === 0) {
    cameraList.value = await Html5Qrcode.getCameras()
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

  console.log('📷 Fallback: Verwende Kamera aus Geräteliste:', backCamera.label)
  await startScanningWithDeviceId(backCamera.id)
}

// Start über das semantische facingMode-Constraint - funktioniert einheitlich auf
// Android Chrome und iOS Safari, ohne auf browserabhängige device.label-Texte
// angewiesen zu sein. Mehrstufiger Fallback, falls das Constraint nicht unterstützt wird.
const startScanningWithFacingMode = async () => {
  try {
    await html5QrCode.start({ facingMode: { exact: 'environment' } }, SCANNER_CONFIG, onScanSuccess, onScanError)
    scannerActive.value = true
    currentCameraId.value = null
    console.log('✅ Scanner has started (facingMode exact environment).')
  } catch (exactError) {
    console.warn('⚠️ facingMode { exact: "environment" } fehlgeschlagen, versuche facingMode "environment":', exactError)
    try {
      await html5QrCode.start({ facingMode: 'environment' }, SCANNER_CONFIG, onScanSuccess, onScanError)
      scannerActive.value = true
      currentCameraId.value = null
      console.log('✅ Scanner has started (facingMode environment).')
    } catch (nonExactError) {
      console.warn('⚠️ facingMode "environment" fehlgeschlagen, Fallback auf Geräteliste:', nonExactError)
      await startScanningWithDeviceListFallback()
    }
  }
}

// Остановка сканера
const stopScanning = async () => {
  if (html5QrCode && scannerActive.value) {
    try {
      await html5QrCode.stop()
      scannerActive.value = false
      console.log('🛑 Scanner has stopped.')
    } catch (error) {
      console.warn('⚠️ Fehler beim Stoppen des Scanners:', error)
      scannerActive.value = false
    }
  }
}

// Manueller Kamerawechsel durch den Nutzer (z. B. bei mehreren Rückkameras)
const selectCamera = async (deviceId) => {
  if (!deviceId || deviceId === currentCameraId.value) {
    showCameraSelector.value = false
    return
  }
  try {
    await stopScanning()
    await startScanningWithDeviceId(deviceId)
    localStorage.setItem(CAMERA_STORAGE_KEY, deviceId)
    showCameraSelector.value = false
  } catch (error) {
    console.error('❌ Fehler beim Wechseln der Kamera:', error)
    alert('Fehler beim Wechseln der Kamera.')
  }
}

// Scanner initialisieren
const initScanner = async () => {
  try {
    html5QrCode = new Html5Qrcode('qr-reader')
    await configStore.loadConfig()

    try {
      cameraList.value = await Html5Qrcode.getCameras()
    } catch (listError) {
      console.warn('⚠️ Kameraliste konnte nicht geladen werden:', listError)
    }

    // Zuvor vom Nutzer manuell gewählte Kamera bevorzugen, sofern sie noch existiert.
    const savedCameraId = localStorage.getItem(CAMERA_STORAGE_KEY)
    const savedCameraStillExists = savedCameraId && cameraList.value.some(device => device.id === savedCameraId)

    if (savedCameraStillExists) {
      console.log('📷 Verwende gespeicherte Kamera:', savedCameraId)
      await startScanningWithDeviceId(savedCameraId)
    } else {
      await startScanningWithFacingMode()
    }
  } catch (error) {
    console.error('❌ Fehler beim Starten des Scanners:', error)
    alert('Fehler beim Zugriff auf die Kamera. Bitte Berechtigungen prüfen.')
  }
}

// ============================================
// QUEUE PROCESSING SYSTEM
// ============================================

// Обработчик очереди (синхронная последовательная обработка)
const processQueue = async () => {
  // Если уже обрабатываем или очередь пуста - выходим
  if (isProcessingQueue || processingQueue.length === 0) {
    return
  }

  isProcessingQueue = true
  console.log('🔄 Start of processing the queue. Total items:', processingQueue.length)

  // Обрабатываем все элементы по одному
  while (processingQueue.length > 0) {
    const decodedText = processingQueue.shift()
    console.log('⚙️ Processing URL in queue', decodedText)
    await processScannedData(decodedText)
  }

  isProcessingQueue = false
  console.log('✅ Queue processing completed.')
}

// Бизнес-логика обработки данных
const processScannedData = async (decodedText) => {
  console.log('🔍 QR-Code gelesen (Beginn Verarbeitung):', decodedText)

  // Clear previous error
  lastError.value = ''

  // Validate QR-Code format
  const qrPattern = createQrCodePattern()
  const match = decodedText.match(qrPattern)

  if (!match) {
    console.warn('⚠️ Ungültiger QR-Code:', decodedText)
    lastError.value = 'Ungültiger QR-Code'
    playSound('error')

    setTimeout(() => {
      lastError.value = ''
    }, 3000)
    return
  }

  // Extract bandId
  const bandId = match[1]
  console.log('🎫 Band-ID:', bandId)

  try {
    // Check if child exists in database
    const child = await armbandComposable.getBraceletStatus(bandId)

    if (!child) {
      console.warn('⚠️ Kein Kind mit diesem Armband verbunden')
      lastError.value = 'Kein Kind ist mit dem Armband verbunden'
      playSound('error')

      setTimeout(() => {
        lastError.value = ''
      }, 5000)
      return
    }
    // Check for duplicate scans
    const alreadyScanned = scannedChildren.value.some(c => c.id === child.id)
    if (alreadyScanned) {
      console.log('ℹ️ Kind bereits gescannt:', child.name)
      return
    }

    // Record presence in database
    await armbandComposable.recordChildPresence(
        userStore.userInfo.id,
        child.id,
        bandId,
        userStore.userInfo.bus_id
    )

    // Add to scanned list
    scannedChildren.value.push(child)
    lastScannedChild.value = child

    console.log('✅ Kind gescannt:', child.name, 'Gruppe:', child.group_id)

    // Success feedback
    playSound('success')
    triggerFlashEffect()
    triggerVibration()

  } catch (error) {
    console.error('❌ Fehler beim Verarbeiten des Scans:', error)
    lastError.value = 'Fehler beim Verarbeiten'
    playSound('error')

    setTimeout(() => {
      lastError.value = ''
    }, 3000)
  }
}

// ============================================
// SCAN HANDLERS
// ============================================

// Erfolgreicher Scan
const onScanSuccess = async (decodedText) => {
  // 🛡️ Level 1: Check for duplicates in Set
  if (scannedUrls.has(decodedText)) {
    return
  }

  // 🛡️ Level 2: Mark as seen in Set
  scannedUrls.add(decodedText)
  console.log('📝 Neuer URL zur Verarbeitung hinzugefügt:', decodedText)

  // 🛡️ Level 3: Add to processing queue
  processingQueue.push(decodedText)
  console.log('➕ URL has been added. Queu size: ', processingQueue.length)

  // 🔄 Run queue processor
  processQueue()
}

// Scan-Fehler (игнорируем - нормально при сканировании)
const onScanError = () => {
  // Ignorieren - normal beim Scannen
}

// ============================================
// EXIT
// ============================================

// Scanner beenden
const exitScanner = async () => {
  await stopScanning()
  router.push('/main')
}

// ============================================
// LIFECYCLE HOOKS
// ============================================

onMounted(() => {
  initScanner()
})

onBeforeUnmount(async () => {
  await stopScanning()
})
</script>

<style scoped>
.scanner-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 15px;
  padding-bottom: 60px;
}

/* Compact Header */
.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 25px;
  font-weight: 600;
  font-size: 0.95rem;
  color: white;
}

.status-badge.active {
  background: rgba(40, 167, 69, 0.3);
  border: 2px solid #28a745;
}

.status-badge.inactive {
  background: rgba(220, 53, 69, 0.3);
  border: 2px solid #dc3545;
}

.pulse-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-exit {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  padding: 10px 20px;
}

.btn-camera {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  font-weight: 600;
}

/* Camera Selector */
.camera-selector {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  padding: 12px 15px;
  border-radius: 12px;
  margin-bottom: 15px;
  color: white;
}

.camera-selector-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  font-weight: 600;
}

/* Counter Bar */
.counter-bar {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 15px;
  color: white;
  text-align: center;
  font-size: 1.1rem;
}

.counter-bar strong {
  font-size: 1.5rem;
  color: #ffd700;
}

/* Scanner Container */
.scanner-container {
  position: relative;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  margin-bottom: 15px;
  transition: all 0.3s ease;
}

.scanner-container.flash-success {
  animation: rainbow-flash 1s ease-in-out;
}

@keyframes rainbow-flash {
  0% {
    box-shadow: 0 0 0 4px rgba(255, 0, 0, 0.9), 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  16.6% {
    box-shadow: 0 0 0 4px rgba(255, 165, 0, 0.9), 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  33.3% {
    box-shadow: 0 0 0 4px rgba(255, 255, 0, 0.9), 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(0, 200, 0, 0.9), 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  66.6% {
    box-shadow: 0 0 0 4px rgba(0, 150, 255, 0.9), 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  83.3% {
    box-shadow: 0 0 0 4px rgba(75, 0, 130, 0.9), 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  100% {
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }
}

#qr-reader {
  width: 100%;
  border: none;
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  color: white;
  font-size: 1rem;
}

/* Last Scanned Child */
.last-scanned {
  margin-bottom: 15px;
  animation: slideIn 0.3s ease-out;
}

.last-scanned .alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
}

.child-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

/* Error Display */
.last-error {
  margin-bottom: 15px;
  animation: shake 0.5s ease-out;
}

.last-error .alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-10px);
  }
  75% {
    transform: translateX(10px);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scanned Children List */
.scanned-list {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.scanned-list h5 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-size: 1.1rem;
}

.children-container {
  max-height: 350px;
  overflow-y: auto;
}

.child-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.child-item:hover {
  background: #e9ecef;
  transform: translateX(5px);
}

.child-number {
  font-weight: 700;
  color: #667eea;
  min-width: 30px;
  font-size: 1rem;
}

.child-details {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.child-name {
  font-weight: 600;
  color: #333;
  flex: 1;
}

/* Scrollbar Styling */
.children-container::-webkit-scrollbar {
  width: 8px;
}

.children-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.children-container::-webkit-scrollbar-thumb {
  background: #667eea;
  border-radius: 4px;
}

.children-container::-webkit-scrollbar-thumb:hover {
  background: #5568d3;
}

/* Responsive */
@media (max-width: 576px) {
  .scanner-view {
    padding: 10px;
  }

  .status-badge {
    font-size: 0.85rem;
    padding: 8px 14px;
  }

  .btn-exit {
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .counter-bar {
    font-size: 1rem;
  }

  .counter-bar strong {
    font-size: 1.3rem;
  }
}
</style>