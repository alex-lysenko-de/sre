// src/composables/useMockConstants.js
// Kleinste gemeinsame Konstanten des Checkpoint-Prototyps (Ticket 130_2),
// ausgelagert aus useCheckpointsMock.js, damit useChildEntityMock.js /
// useBetreuerEntityMock.js sie ohne Zirkelimport lesen koennen (sie werden
// ihrerseits von useCheckpointsMock.js importiert).

export const MOCK_TOTAL_BUSES = 5
export const MOCK_TOTAL_GROUPS = 6
