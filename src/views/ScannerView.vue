<template>
  <div class="container py-4 text-center">
    <h2 class="mb-3">📷 QR-Code Scanner</h2>

    <div v-if="!isScanning">
      <button class="btn btn-primary" @click="startScan">Starten</button>
    </div>

    <div v-else>
      <video ref="video" class="w-100 border rounded" autoplay playsinline></video>
      <div class="mt-3">
        <button class="btn btn-danger" @click="stopScan">Beenden</button>
      </div>
    </div>

    <!-- Bootstrap Modal -->
    <div class="modal fade" id="resultModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Gesammelte QR-Codes</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <ul class="list-group">
              <li v-for="(code, i) in scannedCodes" :key="i" class="list-group-item">
                {{ code }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted, onUnmounted} from 'vue'
import {BrowserMultiFormatReader} from '@zxing/browser'
import {Modal} from 'bootstrap'

const video = ref(null)
const reader = new BrowserMultiFormatReader()
const isScanning = ref(false)
const scannedCodes = ref([])
let modalInstance = null
let beepAudio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')

onMounted(() => {
  modalInstance = new Modal(document.getElementById('resultModal'))
})

onUnmounted(() => stopScan())

async function startScan() {
  isScanning.value = true
  scannedCodes.value = []

  try {
    // 🔒 1. Запрос разрешения на камеру
    await navigator.mediaDevices.getUserMedia({ video : true })

    // 🔍 2. Получаем список устройств после разрешения
    const devices = await BrowserMultiFormatReader.listVideoInputDevices()
    console.log('Gefundene Kameras:', devices)

    const selectedDeviceId =
        devices.find(d => d.label.toLowerCase().includes('back'))?.deviceId ||
        devices[ 0 ]?.deviceId

    if (!selectedDeviceId) {
      alert('Keine Kamera gefunden!')
      isScanning.value = false
      return
    }

    // 🎥 3. Запуск сканирования
    reader.decodeFromVideoDevice(selectedDeviceId, video.value, (result, err) => {
      if (result) {
        const text = result.getText()
        if (!scannedCodes.value.includes(text)) {
          scannedCodes.value.push(text)
          console.log('QR erkannt:', text)
          beepAudio.play()
        }
      }
    })
  } catch (e) {
    console.error('Scan-Fehler:', e)
    alert('Fehler beim Zugriff auf die Kamera!')
    isScanning.value = false
  }
}

function stopScan() {
  if (isScanning.value) {
    reader.reset()
    isScanning.value = false
    if (scannedCodes.value.length > 0) {
      modalInstance.show()
    }
  }
}
</script>

<style scoped>
video {
  max-height: 60vh;
  object-fit: cover;
}
</style>
