<template>
  <div class="scanner-view">
    <!-- Compact Header -->
    <div class="scanner-header">
      <div class="status-badge" :class="scannerActive ? 'active' : 'inactive'">
        <i class="fas fa-circle pulse-icon"></i>
        {{ scannerActive ? 'Scanner aktiv' : 'Gestoppt' }}
      </div>
      <button @click="exitScanner" class="btn btn-danger btn-exit">
        <i class="fas fa-times"></i> Beenden
      </button>
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
import {useConfigStore} from "@/stores/config.js";

const router = useRouter()
const armbandComposable = useArmband()
const configStore = useConfigStore()
const userStore = useUserStore()

// State
const qrReader = ref(null)
const scannedChildren = ref([])
const lastScannedChild = ref(null)
const lastError = ref('')
const scannerActive = ref(false)
const showFlash = ref(false)
let html5QrCode = null

// --- Добавлено для Clean Code & Устранения Дубликатов ---
const isProcessingScan = ref(false) // Флаг для блокировки повторных вызовов
let CAMERA_ID = null // ID камеры для возможности перезапуска

// Конфигурация сканера
const SCANNER_CONFIG = {
  fps : 10,
  qrbox : { width : 250, height : 250 },
  aspectRatio : 1.0
}
// --------------------------------------------------------

// Audio für Success/Error Sounds
const successSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSx+zPLTgjMGHm7A7+OZUQ4NVKvl8LNkHgU2jdXxxHcsBS5+y/LajDYIGWi68OScTgwOUKXh8LllHwU4kdXzyXotBS1+yvLaizYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8Lpl')

const errorSound = new Audio('data:audio/wav;base64,UklGRhQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YfADAACAgICAgICAgICAgICAgICAgICAgICAgICAgH9+fnt5dnNwbWllYV1YVFFNSUVBPTk1MTAtKSYjIB0aGBYUEhAODQwLCgkJCAgIBwcHBwYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYHBwcHCAkJCQoLCwwNDg8RExQWGBobHSAjJiksLzM2Oj5CRklNUVVZXWFmam53fIGGi5CUmZ6kqK2xtLi7vsHDxcfIysvMzM3Nzs7Ozs7Ozs7Nzc3MzMvLysnIx8bFxMPCwL++vLu5t7W0srCuq6mloqCdmpeTkI2KiIWCgH99e3l3dXNxcG9ubnBydHh7f4OHjJCVmZ6kqKywtLi7vsHExsjKzM7P0NHR0tLT09PT09PT09PS0tLR0dDPzs3MysrIxsXEwsG/vbu5t7Wzr62spJ6YkoqDfHZwamRfW1dUUU5MSktJSEdHRkZGRkVFRUVFRUVEREREREREREREQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NEREREREREREVFRUVFRUVGRkZGRkdISUlKS0xNT1FSVFZYWl1fYWRnaGprbG1ub3Bxcm5raGVhXVlVUU1JRUFAPz49PTw8PDs7Ozs7Ozo6Ojo6Ojo6Ojo6Ojo6Ozs7Ozs8PDw9PT4+P0BBQkRFRkdJSktNTlBRU1RWV1laW11eX2BhYmNkZGVlZmZmZmZmZmZlZWVkZGNiYWBfXVxaWVdWVFNRUE5NTEpJSEZFQ0JBPz49PDo5ODYzMTAvLS0rKikpKCgnJycnJycnJygoKCkqKywtLzAxMzU3OTs9QENFSEpMTlFTVVdaXF5hY2ZobG90en+Fio+UmZ6krLG3vcLHzNDV2d3g4+Xl5+fo6enp6unp6ejo5+bl5OLh4N/e3NvZ19bU09HQz83LycjGxMPBv7y6uLa0sa+tqaelpaCbloD8+vj29PPx7+3r6efm5OPi4d/e3NvZ2NfW1dTT0dDPzsrJx8XDwL67t7Swr6uopqOgnpqXk5CNioeDgH13dHFubWxrampqamprbG1ub3J1eHuAhIiMkJSYnJ+jpqmsr7G0trm7vsDCxMbIysvNztDR0tPU1NXW1tfX2NjY2NjY19fW1tXU1NPS0dDPzszLysnHxsPCwL69u7m4trSyr6yqp6SioJ2alpeUkY6LiIV/fXl3dXNxb25tbGtranp5eXl5eHd3d3Z2dXV0dHNzcnFxcXBvb29ubW1sbGtrbGxsbW1ubm9vcHBxcnJzdHV1dnd4eHl6ent8fX5/gIGCg4SFhoeIiImKi4uMjI2Ojo+Pj4+QkJCQkJCPj4+Ojo2NjIyLi4qJiIiHhYWEg4KBgH9+fXx7enl4d3Z1dHNyc3R1dneChYiLjpGUl5qdoKOlqKqsrrCys7S1t7i5uru8vL2+v7/AwMDAwMDAwMDAwMC/v76+vby8u7q5uLe2tbSzsrGwr62sq6qpqKaloqGgnp2cm5mYl5WTkpCPjoyLiYiGhYSDgoGAgH9/fn5+fn5+fn9/gIGBgoOEhIWGh4iIiYqLi4yNjY6Oj4+QkJCQkJCQkJCQkJCQkJCQkJCPj4+Oj42NjIyLioqJiYiHh4aGhYWEhIODgoKBgYGBgICAgICAgICAgICAgA==')

// Get base domain from window.location
const getBaseDomain = () => {
  // check for localhost or file protocol
  if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    // Use base domain from config
    const configDomain = configStore.config.base_url
    if (configDomain) {
      return configDomain
    } else {
      console.warn('⚠️ Keine Basisdomäne in der Konfiguration gefunden, verwende localhost')
      return 'http://localhost'
    }
  } else {
    return window.location.origin
  }

}

// QR-Code Regex Pattern
const createQrCodePattern = () => {
  const domain = getBaseDomain()
  // Escape special characters in domain for regex
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedDomain}\\/?\\?id=(\\d{1,3})$`)
}

// --- Управление Сканером (Clean Code) ---

// Отдельная функция для запуска сканера
const startScanning = async () => {
  if (!CAMERA_ID) return

  await html5QrCode.start(
      CAMERA_ID,
      SCANNER_CONFIG,
      onScanSuccess,
      onScanError
  )
  scannerActive.value = true
  console.log('✅ Scanner успешно запущен.')
}

// Отдельная функция для остановки сканера
const stopScanning = async () => {
  if (html5QrCode && scannerActive.value) {
    try {
      // Использование .stop() для завершения видеопотока
      await html5QrCode.stop()
      scannerActive.value = false
      console.log('🛑 Scanner остановлен.')
    } catch (error) {
      // Это может произойти, если сканер уже остановлен или произошла ошибка
      console.warn('⚠️ Fehler beim Stoppen des Scanners:', error)
      scannerActive.value = false
    }
  }
}

// Scanner initialisieren
const initScanner = async () => {
  try {
    html5QrCode = new Html5Qrcode('qr-reader')
    await configStore.loadConfig()
    const devices = await Html5Qrcode.getCameras()

    if (devices && devices.length > 0) {
      // Rückkamera finden
      const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.includes('0')
      ) || devices[ 0 ]

      console.log('📷 Verwende Kamera:', backCamera.label)
      CAMERA_ID = backCamera.id // Сохраняем ID камеры

      await startScanning() // Запуск через чистую функцию

    } else {
      alert('Keine Kamera gefunden!')
    }
  } catch (error) {
    console.error('❌ Fehler beim Starten des Scanners:', error)
    alert('Fehler beim Zugriff auf die Kamera. Bitte Berechtigungen prüfen.')
  }
}

// --- Бизнес-логика обработки данных (отделена от управления сканером) ---
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
    playSound(errorSound)

    setTimeout(() => {
      lastError.value = ''
    }, 3000)
    return
  }

  // Extract bandId
  const bandId = match[ 1 ]
  console.log('🎫 Band-ID:', bandId)

  try {
    // Check if child exists in database
    const child = await armbandComposable.getBraceletStatus(bandId)

    if (!child) {
      console.warn('⚠️ Kein Kind mit diesem Armband verbunden')
      lastError.value = 'Kein Kind ist mit dem Armband verbunden'
      playSound(errorSound)

      setTimeout(() => {
        lastError.value = ''
      }, 3000)
      return
    }

    // Check for duplicates
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
    playSound(successSound)
    triggerFlashEffect()
    triggerVibration()

  } catch (error) {
    console.error('❌ Fehler beim Verarbeiten des Scans:', error)
    lastError.value = 'Fehler beim Verarbeiten'
    playSound(errorSound)

    setTimeout(() => {
      lastError.value = ''
    }, 3000)
  }
}


// Успешный Scan (Менеджер Потока)
const onScanSuccess = async (decodedText) => {
  // 1. БЛОКИРОВКА: Игнорируем сканирование, если предыдущее еще не завершено
  if (isProcessingScan.value) {
    return
  }

  isProcessingScan.value = true

  // 2. БЛОКИРОВКА СКАНИРОВАНИЯ: Сразу останавливаем, чтобы избежать дубликатов (гонки)
  await stopScanning()

  // 3. ДЕЛЕГИРОВАНИЕ: Передаем обработку данных в отдельную функцию
  await processScannedData(decodedText)

  // 4. РАЗБЛОКИРОВКА: Возобновляем сканирование и сбрасываем флаг
  await startScanning()
  isProcessingScan.value = false
}


// Scan-Fehler (wird oft aufgerufen, nicht loggen)
const onScanError = () => {
  // Ignorieren - normal beim Scannen
}

// Sound abspielen
const playSound = (sound) => {
  try {
    sound.currentTime = 0
    sound.volume = 1.0 // Maximum volume
    sound.play().catch(e => console.warn('Audio-Wiedergabe fehlgeschlagen:', e))
  } catch (error) {
    console.warn('Sound konnte nicht abgespielt werden:', error)
  }
}

// Vibration triggern (PWA)
const triggerVibration = () => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]) // Vibration pattern
    }
  } catch (error) {
    console.warn('Vibration nicht unterstützt:', error)
  }
}

// Flash-Effekt für visuelle Rückmeldung
const triggerFlashEffect = () => {
  showFlash.value = true
  setTimeout(() => {
    showFlash.value = false
  }, 300)
}

// Scanner beenden
const exitScanner = async () => {
  await stopScanning() // Используем чистую функцию

  // Direkt zu /main navigieren
  router.push('/main')
}

// Lifecycle Hooks
onMounted(() => {
  initScanner()
})

onBeforeUnmount(async () => {
  await stopScanning() // Используем чистую функцию
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

.btn-exit {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  padding: 10px 20px;
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
  box-shadow: 0 0 0 4px rgba(40, 167, 69, 0.8),
  0 10px 40px rgba(0, 0, 0, 0.3);
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