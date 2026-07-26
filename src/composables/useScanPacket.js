// src/composables/useScanPacket.js
// Sammlung/Versand des PresencePacket (tickets/120/120.txt, "Формат данных").
// Gemeinsam fuer alle drei Scan-Modi (BUS/GROUP/CHECKIN) - Business-Logik + der
// eigentliche Aufruf der Edge Function `submit-scan-packet` liegen bewusst hier,
// nicht in den Views (Vermeidung von dreifacher Duplikation, wie im Aufruf-Stil
// von InviteGeneratorView.vue).
import { reactive, ref } from 'vue'
import { supabase } from '@/supabase'
import { useUserStore } from '@/stores/user'

export function useScanPacket() {
    const userStore = useUserStore()

    const packet = reactive({
        client_packet_id: null,
        type: null,
        date: null,
        author_id: null,
        started_at: null,
        finished_at: null,
        bus_id: null,
        group_id: null,
        children: []
    })

    // 'idle' | 'sending' | 'sent' | 'error'
    const status = ref('idle')
    const errorMessage = ref('')

    /**
     * Startet einen neuen Durchgang: neue client_packet_id, Kontext (bus_id/group_id)
     * je nach type, leere children-Liste.
     * @param {'BUS'|'GROUP'|'CHECKIN'} type
     * @param {{bus_id?: number, group_id?: number}} context
     */
    const createPacket = (type, context = {}) => {
        packet.client_packet_id = crypto.randomUUID()
        packet.type = type
        packet.date = userStore.getTodayDate()
        packet.author_id = userStore.userInfo.id
        packet.started_at = null
        packet.finished_at = null
        packet.bus_id = type === 'BUS' ? (context.bus_id ?? null) : null
        packet.group_id = type === 'GROUP' ? (context.group_id ?? null) : null
        packet.children.splice(0, packet.children.length)
        status.value = 'idle'
        errorMessage.value = ''
    }

    const isDuplicate = (childId) => packet.children.some(entry => entry.child_id === childId)

    const addEntry = (child, method) => {
        if (isDuplicate(child.id)) {
            return
        }
        const now = new Date().toISOString()
        if (!packet.started_at) {
            packet.started_at = now
        }
        packet.children.push({ child_id: child.id, timestamp: now, method })
    }

    const addScanned = (child) => addEntry(child, 'SCAN')

    const addManual = (child) => addEntry(child, 'MANUAL')

    /**
     * Verwirft den aktuellen Durchgang, beginnt sofort einen neuen mit gleichem
     * type/Kontext, aber neuer client_packet_id.
     */
    const resetPacket = () => {
        createPacket(packet.type, { bus_id: packet.bus_id, group_id: packet.group_id })
    }

    /**
     * Sendet das Paket an die Edge Function `submit-scan-packet` (Vertrag: siehe
     * tickets/120/IMPLEMENTATION_PLAN.md, "API изменения"). Bei Fehler bleiben
     * Paket und client_packet_id unveraendert - ein erneuter Aufruf wiederholt
     * denselben Request (Idempotenz ist Aufgabe des Servers, Ticket 122).
     */
    const submitPacket = async () => {
        status.value = 'sending'
        errorMessage.value = ''
        packet.finished_at = new Date().toISOString()

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                throw new Error('Nicht autorisiert. Bitte melden Sie sich an.')
            }

            const API_URL = import.meta.env.VITE_SUPABASE_URL.replace('.co', '.co/functions/v1')
            const response = await fetch(`${API_URL}/submit-scan-packet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_KEY
                },
                body: JSON.stringify(packet)
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `HTTP Fehler! Status: ${response.status}`)
            }

            const data = await response.json()
            status.value = 'sent'
            return data
        } catch (err) {
            console.error('❌ Fehler beim Senden des Scan-Pakets:', err)
            status.value = 'error'
            errorMessage.value = err.message
            throw err
        }
    }

    return {
        packet,
        status,
        errorMessage,
        createPacket,
        isDuplicate,
        addScanned,
        addManual,
        resetPacket,
        submitPacket
    }
}
