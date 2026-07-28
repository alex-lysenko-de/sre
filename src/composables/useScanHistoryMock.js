// src/composables/useScanHistoryMock.js
// Neue Entitaet "Scan-Historie" (Ticket 130_2, UX-Feedback Runde 4): die
// Kind-Karte muss die vollstaendige Scan-Historie des Tages zeigen. Es gibt
// dafuer keine eigene Datenquelle - die Historie wird ausschliesslich aus
// bereits vorhandenen Checkpoint-Daten synthetisiert (Bus-Packets,
// Gruppen-Zustand, Lazy-Fortschritt), ohne neue Zufallswerte:
// - BUS: das Kind erscheint in bus.children -> zugeordnet zu genau einem
//   Scan-Packet (Packets werden in Reihenfolge mit je packet.childrenCount
//   Kindern "aufgefuellt", damit nicht jedes Kind demselben ersten Packet
//   zugeschrieben wird).
// - GROUP: das Kind ist anwesend, wenn seine Gruppe Daten hat und es nicht
//   in missingChildren steht - Betreuer ist der erste Gruppen-Betreuer.
// - LAZY: das Kind ist anwesend, wenn es in checkedIn steht - Zeit/Betreuer
//   kommen direkt aus dem checkedIn-Eintrag (timestamp/checkedInBy).
//
// Kein Supabase-Import, keine Netzwerkanfrage.

import {
    CHECKPOINT_TYPE,
    fetchCheckpointsForDay,
    todayString
} from './useCheckpointsMock'
import { fetchLazyCheckpointProgress } from './useLazyCheckpointProgressMock'
import { getChildById } from './useChildEntityMock'
import { getBetreuerById } from './useBetreuerEntityMock'

// Ordnet jedem Kind eines Busses genau ein Scan-Packet zu, in der
// Reihenfolge der Packets (packet.childrenCount Kinder je Packet) - so wird
// nicht jedes Kind pauschal dem ersten Packet zugeschrieben.
function assignChildrenToPackets(bus) {
    const assignments = new Map()
    let idx = 0
    for (const packet of bus.packets) {
        for (let i = 0; i < packet.childrenCount && idx < bus.children.length; i++, idx++) {
            assignments.set(bus.children[idx].id, packet)
        }
    }
    return assignments
}

function toBetreuerRef(ref) {
    return ref ? { id: ref.id, name: ref.name } : null
}

/**
 * Scan-Historie eines Kindes fuer einen Tag, ueber alle Checkpoint-Typen
 * hinweg, neueste zuerst.
 *
 * @param {number} childId
 * @param {string} [day]
 * @returns {Promise<Array<{id:string, time:string, checkpointId:number, checkpointType:number, resultLabel:string, betreuer:?{id:number,name:string}}>>}
 */
export async function getChildScanHistoryToday(childId, day = todayString()) {
    const child = getChildById(childId)
    const events = []
    const checkpoints = await fetchCheckpointsForDay(day)

    for (const cp of checkpoints) {
        if (cp.type === CHECKPOINT_TYPE.BUS) {
            for (const bus of cp.buses) {
                if (!bus.hasData) continue
                const found = bus.children.some(c => c.id === childId)
                if (!found) continue
                const packet = assignChildrenToPackets(bus).get(childId)
                events.push({
                    id: `${cp.id}-bus-${bus.busNumber}`,
                    time: packet?.receivedAt || cp.created_at,
                    checkpointId: cp.id,
                    checkpointType: CHECKPOINT_TYPE.BUS,
                    resultLabel: `Bus ${bus.busNumber} – Ankunft erfasst`,
                    betreuer: packet ? { id: packet.authorId, name: packet.authorName } : null
                })
            }
        } else if (cp.type === CHECKPOINT_TYPE.GROUP && child) {
            const group = cp.groups.find(g => g.groupId === child.groupId)
            if (group && group.hasData && !group.missingChildren.some(c => c.id === childId)) {
                events.push({
                    id: `${cp.id}-group-${group.groupId}`,
                    time: cp.finished_at || cp.created_at,
                    checkpointId: cp.id,
                    checkpointType: CHECKPOINT_TYPE.GROUP,
                    resultLabel: `Gruppe ${group.groupId} – anwesend`,
                    betreuer: toBetreuerRef(group.betreuer[0])
                })
            }
        } else if (cp.type === CHECKPOINT_TYPE.LAZY) {
            const progress = await fetchLazyCheckpointProgress(cp.id)
            const entry = progress.checkedIn.find(c => c.id === childId)
            if (entry) {
                events.push({
                    id: `${cp.id}-lazy`,
                    time: entry.timestamp,
                    checkpointId: cp.id,
                    checkpointType: CHECKPOINT_TYPE.LAZY,
                    resultLabel: 'Lazy-Meldung',
                    betreuer: toBetreuerRef(getBetreuerById(entry.checkedInBy))
                })
            }
        }
    }

    events.sort((a, b) => new Date(b.time) - new Date(a.time))
    return events
}

export default {
    getChildScanHistoryToday
}
