<template>
  <div class="scanner-view">
    <!-- Header -->
    <div class="scanner-header">
      <h2>QR-Code Scanner</h2>
      <button @click="exitScanner" class="btn btn-danger btn-exit">
        <i class="fas fa-times"></i> Beenden
      </button>
    </div>

    <!-- Scanner Status -->
    <div class="scanner-status">
      <div class="status-badge" :class="scannerActive ? 'active' : 'inactive'">
        <i class="fas fa-circle"></i>
        {{ scannerActive ? 'Scanner aktiv' : 'Scanner gestoppt' }}
      </div>
      <div class="scan-counter">
        Gescannte Codes: <strong>{{ scannedCodes.length }}</strong>
      </div>
    </div>

    <!-- Scanner Container -->
    <div class="scanner-container">
      <div id="qr-reader" ref="qrReader"></div>
      <div v-if="!scannerActive" class="scanner-overlay">
        <p>Scanner wird initialisiert...</p>
      </div>
    </div>

    <!-- Last Scanned Code Display -->
    <div v-if="lastScannedCode" class="last-scanned">
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i>
        <strong>Letzter Scan:</strong> {{ lastScannedCode }}
      </div>
    </div>

    <!-- Scanned Codes List (scrollable) -->
    <div v-if="scannedCodes.length > 0" class="scanned-list">
      <h5>Gescannte Codes ({{ scannedCodes.length }}):</h5>
      <div class="codes-container">
        <div
            v-for="(code, index) in scannedCodes"
            :key="index"
            class="code-item"
        >
          <span class="code-number">{{ index + 1 }}.</span>
          <span class="code-text">{{ code }}</span>
          <button
              @click="removeCode(index)"
              class="btn btn-sm btn-outline-danger"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Results Modal -->
    <div
        v-if="showResultsModal"
        class="modal-overlay"
        @click.self="closeResultsModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3>Scan-Ergebnisse</h3>
          <button @click="closeResultsModal" class="btn-close-modal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p><strong>Anzahl gescannter Codes:</strong> {{ scannedCodes.length }}</p>
          <div class="results-list">
            <div v-for="(code, index) in scannedCodes" :key="index" class="result-item">
              <span class="result-number">{{ index + 1 }}.</span>
              <span class="result-code">{{ code }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="copyAllCodes" class="btn btn-primary">
            <i class="fas fa-copy"></i> Alle kopieren
          </button>
          <button @click="closeResultsModal" class="btn btn-secondary">
            Schließen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'

const router = useRouter()

// State
const qrReader = ref(null)
const scannedCodes = ref([])
const lastScannedCode = ref('')
const scannerActive = ref(false)
const showResultsModal = ref(false)
let html5QrCode = null

// Audio für Beep-Sound
const beepSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSx+zPLTgjMGHm7A7+OZUQ4NVKvl8LNkHgU2jdXxxHcsBS5+y/LajDYIGWi68OScTgwOUKXh8LllHwU4kdXzyXotBS1+yvLaizYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8LplHwU4kdXzyXotBS1+yvLajDYIGGe88OWbTw0NUKXh8Lpl')

// Scanner initialisieren
const initScanner = async () => {
  try {
    html5QrCode = new Html5Qrcode('qr-reader')

    // Kameras abrufen
    const devices = await Html5Qrcode.getCameras()

    if (devices && devices.length > 0) {
      // Rückkamera finden (normalerweise die erste oder die mit "back" im Label)
      const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.includes('0')
      ) || devices[0]

      console.log('Verwende Kamera:', backCamera.label)

      // Scanner starten
      await html5QrCode.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          onScanSuccess,
          onScanError
      )

      scannerActive.value = true
      console.log('Scanner erfolgreich gestartet')
    } else {
      alert('Keine Kamera gefunden!')
    }
  } catch (error) {
    console.error('Fehler beim Starten des Scanners:', error)
    alert('Fehler beim Zugriff auf die Kamera. Bitte Berechtigungen prüfen.')
  }
}

// Erfolgreicher Scan
const onScanSuccess = (decodedText) => {
  // Duplikate vermeiden
  if (!scannedCodes.value.includes(decodedText)) {
    scannedCodes.value.push(decodedText)
    lastScannedCode.value = decodedText

    // Console.log wie gewünscht
    console.log('QR-Code gescannt:', decodedText)

    // Beep-Sound abspielen
    playBeep()
  }
}

// Scan-Fehler (wird oft aufgerufen, daher nicht loggen)
const onScanError = () => {
  // Ignorieren - normal beim Scannen
}

// Beep-Sound abspielen
const playBeep = () => {
  try {
    beepSound.currentTime = 0
    beepSound.play().catch(e => console.warn('Audio-Wiedergabe fehlgeschlagen:', e))
  } catch (error) {
    console.warn('Beep konnte nicht abgespielt werden:', error)
  }
}

// Code entfernen
const removeCode = (index) => {
  scannedCodes.value.splice(index, 1)
  if (scannedCodes.value.length === 0) {
    lastScannedCode.value = ''
  }
}

// Scanner beenden
const exitScanner = async () => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
      scannerActive.value = false
      console.log('Scanner gestoppt')
    } catch (error) {
      console.error('Fehler beim Stoppen des Scanners:', error)
    }
  }

  // Ergebnisse anzeigen, wenn Codes gescannt wurden
  if (scannedCodes.value.length > 0) {
    showResultsModal.value = true
  } else {
    // Zurück zur vorherigen Seite
    router.back()
  }
}

// Modal schließen
const closeResultsModal = () => {
  showResultsModal.value = false
  router.back()
}

// Alle Codes kopieren
const copyAllCodes = () => {
  const allCodes = scannedCodes.value.join('\n')
  navigator.clipboard.writeText(allCodes)
      .then(() => {
        alert('Alle Codes in die Zwischenablage kopiert!')
      })
      .catch(err => {
        console.error('Kopieren fehlgeschlagen:', err)
      })
}

// Lifecycle Hooks
onMounted(() => {
  initScanner()
})

onBeforeUnmount(async () => {
  if (html5QrCode && scannerActive.value) {
    try {
      await html5QrCode.stop()
    } catch (error) {
      console.error('Fehler beim Cleanup:', error)
    }
  }
})
</script>

<style scoped>
.scanner-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  padding-bottom: 80px;
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.scanner-header h2 {
  color: white;
  margin: 0;
  font-size: 1.5rem;
}

.btn-exit {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.scanner-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 20px;
  color: white;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
}

.status-badge.active {
  background: rgba(40, 167, 69, 0.3);
  border: 2px solid #28a745;
}

.status-badge.inactive {
  background: rgba(220, 53, 69, 0.3);
  border: 2px solid #dc3545;
}

.status-badge i {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.scan-counter {
  font-size: 1.1rem;
}

.scan-counter strong {
  font-size: 1.4rem;
  color: #ffd700;
}

.scanner-container {
  position: relative;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  margin-bottom: 20px;
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
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
}

.last-scanned {
  margin-bottom: 20px;
  animation: slideIn 0.3s ease-out;
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

.last-scanned .alert {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.95rem;
  margin: 0;
}

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
}

.codes-container {
  max-height: 300px;
  overflow-y: auto;
}

.code-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.code-item:hover {
  background: #e9ecef;
  transform: translateX(5px);
}

.code-number {
  font-weight: 700;
  color: #667eea;
  min-width: 30px;
}

.code-text {
  flex: 1;
  word-break: break-all;
  font-family: monospace;
  font-size: 0.9rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.btn-close-modal {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.btn-close-modal:hover {
  background: #f8f9fa;
  color: #000;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.results-list {
  margin-top: 15px;
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
}

.result-number {
  font-weight: 700;
  color: #667eea;
  min-width: 30px;
}

.result-code {
  font-family: monospace;
  word-break: break-all;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #dee2e6;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* Responsive */
@media (max-width: 576px) {
  .scanner-view {
    padding: 15px;
  }

  .scanner-header h2 {
    font-size: 1.2rem;
  }

  .scanner-status {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-footer button {
    width: 100%;
  }
}
</style>