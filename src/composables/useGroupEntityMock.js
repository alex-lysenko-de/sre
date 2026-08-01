// src/composables/useGroupEntityMock.js
// Neue Entitaet "Gruppe" (Ticket 130_2, UX-Feedback Runde 4) - im
// Unterschied zur bisherigen, Checkpoint-gebundenen Gruppenansicht (Page 3,
// /admin/checkpoints-prototype/group/:id) ist dies eine eigenstaendige,
// tagesuebergreifende Sicht auf eine Gruppe: Roster (kanonisch, aus
// useChildEntityMock.js), alle Betreuer, die ihr heute in irgendeiner
// GROUP-Checkpoint zugeordnet waren, das aktuellste Ergebnis und die
// vollstaendige Tageshistorie. Baut ausschliesslich auf bereits
// vorhandenen Checkpoint-Daten auf, keine neue Zufallslogik.

import { CHECKPOINT_TYPE, fetchCheckpointsForDay, todayString } from './useCheckpointsMock'
import { getChildrenByGroup } from './useChildEntityMock'

function statusOf(group) {
    if (!group.hasData) return 'none'
    if (group.current === group.morning) return 'ok'
    if (group.current < group.morning) return 'missing'
    return 'extra'
}

/**
 * Gesamtsicht auf eine Gruppe fuer einen Tag.
 *
 * @param {number} groupId
 * @param {string} [day]
 * @returns {Promise<{
 *   groupId:number,
 *   children:Array,
 *   betreuer:Array<{id:number,name:string}>,
 *   currentResult:?{checkpointId:number,seq:number,time:string,morning:number,current:number,missingCount:?number,status:string},
 *   dayHistory:Array
 * }>}
 */
export async function fetchGroupEntity(groupId, day = todayString()) {
    const groupCheckpoints = (await fetchCheckpointsForDay(day)).filter(cp => cp.type === CHECKPOINT_TYPE.GROUP)
    const children = getChildrenByGroup(groupId)

    const betreuerById = new Map()
    const dayHistory = []

    for (const cp of groupCheckpoints) {
        const group = cp.groups.find(g => g.groupId === groupId)
        if (!group) continue

        for (const b of group.betreuer) {
            betreuerById.set(b.id, b)
        }

        dayHistory.push({
            checkpointId: cp.id,
            seq: cp.seq,
            time: cp.finished_at || cp.created_at,
            morning: group.morning,
            current: group.current,
            missingCount: group.hasData ? Math.max(0, group.morning - group.current) : null,
            status: statusOf(group)
        })
    }

    dayHistory.sort((a, b) => new Date(a.time) - new Date(b.time))
    const currentResult = dayHistory.length ? dayHistory[dayHistory.length - 1] : null

    return {
        groupId,
        children,
        betreuer: Array.from(betreuerById.values()),
        currentResult,
        dayHistory
    }
}

export default {
    fetchGroupEntity
}
