// src/composables/useBetreuerEntity.js
// Reales Pendant zu useBetreuerEntityMock.js (Ticket 133) - liest die echte
// users-Tabelle statt eines synthetischen Rosters. "Betreuer" ist hier jeder
// Eintrag in users, nicht durch role gefiltert (offene Frage aus 133.txt,
// "Что должно быть реализовано", п.8 - useGroups.js/useBusData.js filtern
// beim Laden der heutigen Zuordnung ebenfalls nicht nach role, sondern nach
// user_group_day.isPresentToday). isAdmin wird stattdessen mitgeliefert,
// damit BetreuerLink.vue (unveraendert aus dem Prototypen uebernommen)
// Admins weiterhin als nicht anklickbaren Text darstellt - exakt dieselbe
// Unterscheidung wie im Mock (ADMIN_USER.isAdmin), nur aus role==='admin'
// abgeleitet statt hart codiert.
import { supabase } from '@/supabase'

function mapUserRow(row) {
    if (!row) return null
    return {
        id: row.id,
        name: row.display_name,
        email: row.email,
        phone: row.phone,
        isAdmin: row.role === 'admin'
    }
}

/**
 * Betreuer/Admin anhand der users.id.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getBetreuerById(id) {
    const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, phone, role')
        .eq('id', id)
        .maybeSingle()

    if (error) throw error
    return mapUserRow(data)
}

/**
 * Betreuer/Admin anhand des Anzeigenamens - Übergangshilfe wie im Mock,
 * solange nicht ueberall Ids statt Namen verwendet werden.
 *
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
export async function getBetreuerByName(name) {
    const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, phone, role')
        .eq('display_name', name)
        .maybeSingle()

    if (error) throw error
    return mapUserRow(data)
}

/**
 * Batch-Auflösung mehrerer Ids - fuer Listen (Scan-Historie, Pakete), damit
 * nicht pro Zeile einzeln nachgefragt werden muss.
 *
 * @param {Array<number>} ids
 * @returns {Promise<Map<number, Object>>}
 */
export async function getBetreuerByIds(ids) {
    const uniqueIds = [...new Set((ids || []).filter(id => id != null))]
    if (!uniqueIds.length) return new Map()

    const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, phone, role')
        .in('id', uniqueIds)

    if (error) throw error
    return new Map((data || []).map(row => [row.id, mapUserRow(row)]))
}

export default {
    getBetreuerById,
    getBetreuerByName,
    getBetreuerByIds
}
