// src/composables/useGroupEntity.js
// Real counterpart to useGroupEntityMock.js (Ticket 131) - a standalone,
// day-spanning view of a group (roster, Betreuer across today's GROUP
// checkpoints, latest result, full day history), distinct from the
// checkpoint-scoped Group view (CheckpointGroupView.vue). Built entirely
// from already-existing real data (useChildren.fetchChildrenByGroup() +
// useCheckpoints.js), no new tables.
import { CHECKPOINT_TYPE, fetchCheckpointsForDay, fetchCheckpointDetail, todayString } from './useCheckpoints'
import { useChildren } from './useChildren'

function statusOf(group) {
    if (!group.hasData) return 'none'
    if (group.current === group.morning) return 'ok'
    if (group.current < group.morning) return 'missing'
    return 'extra'
}

/**
 * @param {number} groupId
 * @param {string} [day]
 * @returns {Promise<{groupId:number, children:Array, betreuer:Array, currentResult:?Object, dayHistory:Array}>}
 */
export async function fetchGroupEntity(groupId, day = todayString()) {
    const { fetchChildrenByGroup } = useChildren()
    const dayCheckpoints = (await fetchCheckpointsForDay(day)).filter(cp => cp.type === CHECKPOINT_TYPE.GROUP)
    const roster = await fetchChildrenByGroup(groupId)
    const children = roster.map(c => ({ ...c, groupId }))

    const betreuerById = new Map()
    const dayHistory = []

    for (const cpRow of dayCheckpoints) {
        const cp = await fetchCheckpointDetail(cpRow.id)
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
