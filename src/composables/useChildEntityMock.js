// src/composables/useChildEntityMock.js
// Kanonischer Kinder-Roster fuer den Checkpoint-Prototypen (Ticket 130_2,
// UX-Feedback Runde 4 - "Entity-zentrierte" Ueberarbeitung). Vorher lag der
// Kinder-Pool (CHILD_NAMES) privat in useCheckpointsMock.js und Kinder
// hatten ausserhalb der Gruppenrosters keine stabile id. Jetzt ist die Id
// (Position im Pool, 1-24) die kanonische, ueberall verwendete Kind-Id -
// GROUP_ROSTER/group.missingChildren nutzten diese Zahl ohnehin schon.
//
// Zusaetzliche Felder (age, parentA/B, phone, schwimmer, band_id, notes)
// existieren in keiner echten Tabelle mit diesem Namen - sie sind fuer den
// Prototyp erfunden, aber deterministisch aus der id abgeleitet (kein
// Math.random()), damit ein Kind bei jedem Neuladen dieselben Werte zeigt.
// Feldnamen orientieren sich an ChildDetailView.vue (age, schwimmer,
// band_id, notes), damit die neue Kind-Karte vertraut wirkt.
//
// Kein Supabase-Import, keine Netzwerkanfrage - reines Mock, wie der Rest
// des Prototyps.

import { reactive } from 'vue'
import { MOCK_TOTAL_GROUPS } from './useMockConstants'

const CHILD_FIRST_LAST = [
    ['Anna', 'Krause'], ['Ben', 'Vogel'], ['Clara', 'Wolf'], ['David', 'Fuchs'], ['Emma', 'Braun'], ['Finn', 'Berger'],
    ['Greta', 'Lang'], ['Hannes', 'Roth'], ['Ida', 'Herrmann'], ['Jonas', 'Baur'], ['Klara', 'Schuster'], ['Leo', 'Franke'],
    ['Mia', 'Winkler'], ['Noah', 'Kraus'], ['Olivia', 'Peters'], ['Paul', 'Sommer'], ['Quirin', 'Graf'], ['Rosa', 'Horn'],
    ['Sara', 'Busch'], ['Tom', 'Seidel'], ['Ute', 'Kaiser'], ['Vincent', 'Ludwig'], ['Wanda', 'Krüger'], ['Xaver', 'Otto']
]

// Vornamen-Pool fuer Eltern - bewusst unabhaengig von den Kindernamen, damit
// nicht wie zufaellig ein Kind und sein Elternteil denselben Vornamen tragen.
const PARENT_FIRST_NAMES = [
    'Michael', 'Sandra', 'Thomas', 'Julia', 'Stefan', 'Nicole',
    'Andreas', 'Claudia', 'Markus', 'Petra', 'Christian', 'Sabine'
]

function buildRoster() {
    return CHILD_FIRST_LAST.map(([firstName, lastName], idx) => {
        const id = idx + 1
        return {
            id,
            name: `${firstName} ${lastName}`,
            groupId: (idx % MOCK_TOTAL_GROUPS) + 1,
            age: 6 + (id % 9),
            parentA: `${PARENT_FIRST_NAMES[id % PARENT_FIRST_NAMES.length]} ${lastName}`,
            parentB: `${PARENT_FIRST_NAMES[(id + 6) % PARENT_FIRST_NAMES.length]} ${lastName}`,
            phone: `0151-${String(4000000 + id * 37211).padStart(7, '0').slice(-7)}`,
            schwimmer: id % 5,
            band_id: `A-${1000 + id}`,
            notes: id % 3 === 0 ? 'Keine besonderen Hinweise.' : ''
        }
    })
}

export const CHILD_ROSTER = reactive(buildRoster())

/**
 * Kind anhand der kanonischen Id (1-24).
 *
 * @param {number} id
 * @returns {Object|null}
 */
export function getChildById(id) {
    return CHILD_ROSTER.find(c => c.id === id) || null
}

/**
 * Alle Kinder einer Gruppe, sortiert nach Id - ersetzt den bisherigen
 * GROUP_ROSTER-Build in useCheckpointsMock.js (dieselbe Zuordnungsregel,
 * jetzt aus dem kanonischen Roster gelesen statt separat berechnet).
 *
 * @param {number} groupId
 * @returns {Array<Object>}
 */
export function getChildrenByGroup(groupId) {
    return CHILD_ROSTER.filter(c => c.groupId === groupId)
}

/**
 * Aendert ein Kind im kanonischen Roster (funktionales Mock-Edit, UX-
 * Feedback Runde 4 - keine Persistenz, nur die reactive-Instanz). Gruppe/
 * Eltern/Telefon/Armband bleiben bewusst unveraenderbar (ausserhalb des
 * vereinbarten Bearbeitungsumfangs).
 *
 * @param {number} id
 * @param {{name?:string, age?:number, schwimmer?:number, notes?:string}} changes
 * @returns {Object|{error:'NOT_FOUND'}}
 */
export function updateChild(id, changes) {
    const child = getChildById(id)
    if (!child) {
        return { error: 'NOT_FOUND' }
    }
    if (changes.name != null) child.name = changes.name
    if (changes.age != null) child.age = changes.age
    if (changes.schwimmer != null) child.schwimmer = changes.schwimmer
    if (changes.notes != null) child.notes = changes.notes
    return child
}

export default {
    CHILD_ROSTER,
    getChildById,
    getChildrenByGroup,
    updateChild
}
