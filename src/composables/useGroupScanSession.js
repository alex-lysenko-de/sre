// src/composables/useGroupScanSession.js
// Kapselt die eingebettete Scan-Session der Kopfzaehlung (tickets/123/123.txt,
// Punkt 7-8; Kamera-statt-Panel-Verhalten seit tickets/126/126.txt Punkt 5):
// Paketaufbau + Business-Regel "falsche Gruppe"/Duplikat - dieselbe Logik wie
// ScannerGroupView.vue (Gruppen-Appell, Ticket 120) -, plus der 5-Sekunden-
// Inaktivitaets-Timer nach dem letzten erfolgreichen Scan, der die Kamera
// (nicht mehr das ganze Panel) automatisch abschaltet und das Paket im
// Hintergrund sendet.
//
// Bewusstes Duplikat der "falsche Gruppe"/Duplikat-Regel aus
// ScannerGroupView.handleResolved() - ein gemeinsamer Ort fuer beide Stellen
// waere ein Refactoring ausserhalb des Umfangs von Ticket 123 (siehe
// tickets/123/IMPLEMENTATION_PLAN.md, "Risiken").
import { ref } from 'vue'
import { useScanPacket } from '@/composables/useScanPacket'

const AUTO_CLOSE_IDLE_MS = 5000

/**
 * @param {import('vue').Ref<number>} groupIdRef - Gruppe des Screens; wird bei
 *   jedem Aufruf ausgelesen (nicht einmalig erfasst), da sie beim Laden des
 *   Screens asynchron (userStore.loadUser()) gesetzt werden kann und zum
 *   Konstruktionszeitpunkt des Composables noch nicht feststehen muss.
 * @param {import('vue').Ref<Array>} childrenRef - reaktive Kinderliste des
 *   Kopfzaehlung-Screens (Eintraege mit { id, presentNow })
 * @param {import('vue').Ref} scannerRef - Template-Ref auf das eingebettete
 *   <Scanner>, um dessen Kamera ueber start()/stop() zu steuern, statt das
 *   Panel zu mounten/unmounten.
 */
export function useGroupScanSession(groupIdRef, childrenRef, scannerRef) {
    const scanPacket = useScanPacket()

    // Spiegelt scannerActive aus Scanner.vue (per camera-started/camera-stopped
    // Events) - dient hier nur intern der Entscheidung, ob ein neues Paket
    // begonnen werden muss, nicht mehr dem Ein-/Ausblenden von Markup.
    const isOpen = ref(false)
    const sendError = ref('')
    let idleTimer = null

    const clearIdleTimer = () => {
        if (idleTimer) {
            clearTimeout(idleTimer)
            idleTimer = null
        }
    }

    const markPresentNow = (childId) => {
        const child = childrenRef.value.find(c => c.id === childId)
        if (child) {
            child.presentNow = true
        }
    }

    const submitInBackground = async () => {
        try {
            await scanPacket.submitPacket()
            sendError.value = ''
        } catch (error) {
            sendError.value = scanPacket.errorMessage.value || 'Fehler beim Senden des Scans.'
        }
    }

    const closePanel = () => {
        clearIdleTimer()
        scannerRef.value?.stop()
        submitInBackground()
    }

    const scheduleAutoClose = () => {
        clearIdleTimer()
        idleTimer = setTimeout(closePanel, AUTO_CLOSE_IDLE_MS)
    }

    /**
     * An Scanner.vue als @camera-started zu uebergeben - startet einen neuen
     * Paket-Durchgang, sobald die Kamera tatsaechlich anspringt (auch beim
     * ersten Start ueber die eingebaute Scan-Schaltflaeche von Scanner.vue).
     */
    const onCameraStarted = () => {
        scanPacket.createPacket('GROUP', { group_id: groupIdRef.value })
        sendError.value = ''
        isOpen.value = true
    }

    /**
     * An Scanner.vue als @camera-stopped zu uebergeben.
     */
    const onCameraStopped = () => {
        isOpen.value = false
    }

    /**
     * An Scanner.vue als onChildResolved zu uebergeben.
     */
    const handleResolved = async (result) => {
        if (result.status !== 'found') {
            return undefined // Scanner zeigt den Standardbildschirm selbst.
        }

        const child = result.child

        if (child.group_id !== groupIdRef.value) {
            // Geschaeftslogik-Fehler, kein Scan-Fehler - gleiche Regel wie
            // ScannerGroupView.handleResolved (Ticket 120).
            return {
                title: 'Kind gehört nicht zu dieser Gruppe',
                subtitle: child.name,
                variant: 'error'
            }
        }

        if (scanPacket.isDuplicate(child.id)) {
            scheduleAutoClose()
            return { title: 'Bereits erfasst', subtitle: child.name, variant: 'success', repeat: true }
        }

        scanPacket.addScanned(child)
        markPresentNow(child.id)
        scheduleAutoClose()

        return undefined // Scanner zeigt den Standard-Erfolgsbildschirm.
    }

    const retrySend = () => submitInBackground()

    return {
        isOpen,
        sendError,
        onCameraStarted,
        onCameraStopped,
        handleResolved,
        retrySend
    }
}
