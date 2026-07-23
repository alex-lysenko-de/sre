// src/composables/useChildPresence.js
import {supabase} from '@/supabase';

export function useChildPresence() {

    /**
     * Ruft die heutige Anwesenheit aller Kinder einer Gruppe ab.
     * @param {number} groupId - ID der Gruppe
     * @returns {Promise<Map<number, {presence_morning: number|null, presence_now: number|null}>>}
     */
    const getTodayGroupPresence = async (groupId) => {
        const { data, error } = await supabase
            .from('children_today')
            .select('child_id, presence_morning, presence_now')
            .eq('group_id', groupId);

        if (error) {
            console.error('Fehler beim Abrufen der heutigen Anwesenheit:', error);
            throw new Error(error.message);
        }

        const presenceMap = new Map();
        (data || []).forEach(row => {
            presenceMap.set(row.child_id, {
                presence_morning : row.presence_morning,
                presence_now : row.presence_now
            });
        });
        return presenceMap;
    };

    /**
     * Setzt den "Jetzt anwesend"-Status eines Kindes. Ändert nie presence_morning/presence_today.
     * @param {number} childId - ID des Kindes
     * @param {number} groupId - ID der Gruppe (nur für den Fall, dass noch kein Eintrag existiert)
     * @param {boolean} isPresent - Neuer Anwesenheitsstatus
     * @param {number} currentUserId - users.id des handelnden Betreuers
     */
    const setPresentNow = async (childId, groupId, isPresent, currentUserId) => {
        const presenceNow = isPresent ? 1 : 0;

        const { data : existing, error : selectError } = await supabase
            .from('children_today')
            .select('id')
            .eq('child_id', childId)
            .maybeSingle();

        if (selectError) {
            console.error('Fehler beim Prüfen des Anwesenheitseintrags:', selectError);
            throw new Error(selectError.message);
        }

        if (existing) {
            const { data, error } = await supabase
                .from('children_today')
                .update({ presence_now : presenceNow, user_id : currentUserId })
                .eq('child_id', childId)
                .select()
                .single();

            if (error) {
                console.error('Fehler beim Aktualisieren der Anwesenheit:', error);
                // PGRST116 = keine Zeile zurückgegeben, i.d.R. weil die RLS-Policy
                // die UPDATE-Zeile unsichtbar gemacht hat (0 betroffene Zeilen).
                // Ohne diese Prüfung meldet Supabase hier fälschlich Erfolg (error: null).
                if (error.code === 'PGRST116') {
                    throw new Error('Speichern nicht erlaubt oder Kind nicht gefunden (keine Zeile aktualisiert).');
                }
                throw new Error(error.message);
            }
            if (!data) {
                throw new Error('Speichern nicht erlaubt oder Kind nicht gefunden (keine Zeile aktualisiert).');
            }
        } else {
            const { error } = await supabase
                .from('children_today')
                .insert({ user_id : currentUserId, child_id : childId, group_id : groupId, presence_now : presenceNow });

            if (error) {
                // 23505 = unique_violation auf children_today_child_id_key: ein anderer
                // Betreuer hat dieses Kind zwischen SELECT und INSERT bereits angelegt
                // (Race bei gleichzeitiger Erstmarkierung). Fallback auf UPDATE.
                if (error.code === '23505') {
                    const { data, error : updateError } = await supabase
                        .from('children_today')
                        .update({ presence_now : presenceNow, user_id : currentUserId })
                        .eq('child_id', childId)
                        .select()
                        .single();

                    if (updateError || !data) {
                        console.error('Fehler beim Aktualisieren nach Race-Fallback:', updateError);
                        throw new Error('Speichern nicht erlaubt oder Kind nicht gefunden (keine Zeile aktualisiert).');
                    }
                    return;
                }

                console.error('Fehler beim Erstellen des Anwesenheitseintrags:', error);
                throw new Error(error.message);
            }
        }
    };

    return {
        getTodayGroupPresence,
        setPresentNow,
    };
}
