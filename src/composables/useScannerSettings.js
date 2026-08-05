// src/composables/useScannerSettings.js
// Geraete-lokale Einstellungen des Scanner-Moduls (tickets/126/126.txt, Punkt 4):
// bevorzugte Kamera + Anzeigedauer der Bestaetigungsbildschirme. Persoenliche
// Einstellung des Geraets, nicht der Organisation - deshalb localStorage statt
// useConfigStore (siehe tickets/126/IMPLEMENTATION_PLAN.md).
//
// Modul-globaler Shared State (wie src/modules/storage.js) statt neuem State
// pro Aufruf - Scanner.vue und ScannerSettingsView.vue muessen dieselben
// reaktiven Refs sehen, damit eine Aenderung auf dem Einstellungsbildschirm
// ohne Reload im Scanner wirkt.
import { ref } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const SETTINGS_STORAGE_KEY = 'scanner_settings'
// Alter Schluessel aus Scanner.vue vor Ticket 126 - einmalige Migration beim
// ersten Lesen, damit bereits gewaehlte Kameras nicht stillschweigend auf den
// automatischen Modus zurueckfallen.
const LEGACY_CAMERA_STORAGE_KEY = 'scanner_preferred_camera_id'

const DEFAULT_SETTINGS = {
    preferredCameraId: null, // null = automatischer Modus (facingMode)
    successDurationMs: 1600,
    errorDurationMs: 3000,
    // tickets/141_2/141_2.txt: Parameter fuer confirmResumed() in Scanner.vue -
    // wie oft/mit welchem Abstand nach einem html5QrCode.resume() der reale
    // Zustand (getState()) abgefragt wird, bevor auf den zuverlaessigen, aber
    // sichtbar blinkenden stop()+start()-Kaltstart zurueckgefallen wird.
    confirmResumeRetries: 3,
    confirmResumeDelayMs: 100
}

// Erlaubte Wertebereiche fuer die UI (ScannerSettingsView.vue) - siehe
// tickets/141_2/141_2.txt, "решение": Ausreisser wuerden entweder den
// Normalfall unnoetig verlangsamen (zu hohe Werte) oder dem Kamera-Treiber
// keine faire Chance geben, "playing" noch rechtzeitig zu feuern (zu niedrige
// Werte), bevor auf den Kaltstart zurueckgefallen wird.
export const CONFIRM_RESUME_RETRIES_RANGE = { min: 1, max: 10, step: 1 }
export const CONFIRM_RESUME_DELAY_MS_RANGE = { min: 50, max: 500, step: 25 }

const cameraList = ref([])
const preferredCameraId = ref(DEFAULT_SETTINGS.preferredCameraId)
const successDurationMs = ref(DEFAULT_SETTINGS.successDurationMs)
const errorDurationMs = ref(DEFAULT_SETTINGS.errorDurationMs)
const confirmResumeRetries = ref(DEFAULT_SETTINGS.confirmResumeRetries)
const confirmResumeDelayMs = ref(DEFAULT_SETTINGS.confirmResumeDelayMs)

const persist = () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        preferredCameraId: preferredCameraId.value,
        successDurationMs: successDurationMs.value,
        errorDurationMs: errorDurationMs.value,
        confirmResumeRetries: confirmResumeRetries.value,
        confirmResumeDelayMs: confirmResumeDelayMs.value
    }))
}

const loadSettings = () => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)

    if (raw) {
        try {
            const saved = JSON.parse(raw)
            preferredCameraId.value = saved.preferredCameraId ?? DEFAULT_SETTINGS.preferredCameraId
            successDurationMs.value = saved.successDurationMs ?? DEFAULT_SETTINGS.successDurationMs
            errorDurationMs.value = saved.errorDurationMs ?? DEFAULT_SETTINGS.errorDurationMs
            confirmResumeRetries.value = saved.confirmResumeRetries ?? DEFAULT_SETTINGS.confirmResumeRetries
            confirmResumeDelayMs.value = saved.confirmResumeDelayMs ?? DEFAULT_SETTINGS.confirmResumeDelayMs
        } catch (error) {
            console.warn('⚠️ Scanner-Einstellungen konnten nicht gelesen werden:', error)
        }
        return
    }

    const legacyCameraId = localStorage.getItem(LEGACY_CAMERA_STORAGE_KEY)
    if (legacyCameraId) {
        preferredCameraId.value = legacyCameraId
        persist()
    }
}

let loaded = false
const ensureLoaded = () => {
    if (!loaded) {
        loaded = true
        loadSettings()
    }
}

export function useScannerSettings() {
    ensureLoaded()

    const loadCameraList = async () => {
        cameraList.value = await Html5Qrcode.getCameras()
        return cameraList.value
    }

    const setPreferredCameraId = (id) => {
        preferredCameraId.value = id
        persist()
    }

    const setSuccessDurationMs = (ms) => {
        successDurationMs.value = ms
        persist()
    }

    const setErrorDurationMs = (ms) => {
        errorDurationMs.value = ms
        persist()
    }

    const setConfirmResumeRetries = (count) => {
        confirmResumeRetries.value = count
        persist()
    }

    const setConfirmResumeDelayMs = (ms) => {
        confirmResumeDelayMs.value = ms
        persist()
    }

    return {
        cameraList,
        preferredCameraId,
        successDurationMs,
        errorDurationMs,
        confirmResumeRetries,
        confirmResumeDelayMs,
        loadCameraList,
        setPreferredCameraId,
        setSuccessDurationMs,
        setErrorDurationMs,
        setConfirmResumeRetries,
        setConfirmResumeDelayMs
    }
}
