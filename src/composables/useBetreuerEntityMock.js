// src/composables/useBetreuerEntityMock.js
// Kanonischer Betreuer-Roster fuer den Checkpoint-Prototypen (Ticket 130_2,
// UX-Feedback Runde 4). Vorher gab es zwei unabhaengige, teilweise
// ueberlappende Betreuer-Quellen in useCheckpointsMock.js: drei vollwertige
// Objekte (Müller/Schmidt/Fischer, id 101-103) und einen 12-Namen-Pool aus
// reinen Strings (dessen erste 3 Eintraege dieselben Namen dupliziert
// haben) - de facto nur 12 eindeutige Personen. Hier zu einem Roster
// vereinheitlicht, damit jeder Betreuer eine stabile, routebare Id hat.
//
// email/phone existieren in keiner echten Tabelle unter diesem Namen -
// erfunden, aber deterministisch aus id/Name abgeleitet (kein
// Math.random()).

import { reactive } from 'vue'

const NAMES = [
    'Müller', 'Schmidt', 'Fischer', 'Weber', 'Meyer', 'Wagner',
    'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein'
]

function slug(name) {
    return name
        .toLowerCase()
        .replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ß/g, 'ss')
}

function buildRoster() {
    return NAMES.map((name, idx) => {
        const id = 101 + idx
        return {
            id,
            name,
            email: `${slug(name)}@camp-mock.example`,
            phone: `0160-${String(5000000 + id * 4231).padStart(7, '0').slice(-7)}`
        }
    })
}

export const BETREUER_ROSTER = reactive(buildRoster())

/**
 * Betreuer anhand der kanonischen Id (101-112).
 *
 * @param {number} id
 * @returns {Object|null}
 */
export function getBetreuerById(id) {
    return BETREUER_ROSTER.find(b => b.id === id) || null
}

/**
 * Betreuer anhand des Namens - Uebergangshilfe, solange noch nicht jede
 * Stelle im Code Ids statt Namen traegt.
 *
 * @param {string} name
 * @returns {Object|null}
 */
export function getBetreuerByName(name) {
    return BETREUER_ROSTER.find(b => b.name === name) || null
}

export default {
    BETREUER_ROSTER,
    getBetreuerById,
    getBetreuerByName
}
