// src/composables/useChildren.js
import {supabase} from '@/supabase';

export function useChildren() {

    /**
     * Erstellt ein neues Kind und bindet einen Armbandcode.
     * @param {object} childData - { name, age, schwimmer, group_id }
     * @param {bigint} bandId - Armbandcode (n)
     */
    const createChildAndBind = async (childData, bandId) => {
        const payload = {
            ...childData,
            band_id : bandId,
            created_at : new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('children')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Fehler beim Erstellen und Binden des Kindes:', error);
            throw new Error(error.message);
        }
        return data;
    };

    /**
     * Bindet einen Armbandcode an ein bestehendes Kind.
     * @param {number} childId - ID des bestehenden Kindes
     * @param {bigint} bandId - Armbandcode (n)
     */
    const bindBraceletToExistingChild = async (childId, bandId) => {
        const { data : existingChild, error : checkError } = await supabase
            .from('children')
            .select('id, name')
            .eq('band_id', bandId)
            .maybeSingle();

        if (checkError) throw new Error(checkError.message);

        if (existingChild) {
            // Wenn das Armband bereits gebunden ist, muss es zuerst entbunden werden
            await unbindBracelet(bandId);
        }

        const { data, error } = await supabase
            .from('children')
            .update({ band_id : bandId })
            .eq('id', childId)
            .select()
            .single();

        if (error) {
            console.error('Fehler beim Binden des Armbands:', error);
            throw new Error(error.message);
        }
        return data;
    };

    /**
     * Entbindet das Armband von dem Kind, das es zuvor benutzt hat.
     */
    const unbindBracelet = async (bandId) => {
        const { error } = await supabase
            .from('children')
            .update({ band_id : null })
            .eq('band_id', bandId);

        if (error) {
            console.error('Fehler beim Entbinden des alten Armbands:', error);
            throw new Error(`Fehler beim Entbinden des alten Armbands: ${error.message}`);
        }
        return true;
    }


    /**
     * Ruft eine Liste aller Kinder ab (für einen Selektor).
     */
    const fetchAllChildren = async () => {
        const { data, error } = await supabase
            .from('children')
            .select('id, name, group_id')
            .order('name', { ascending : true });

        if (error) {
            console.error('Fehler beim Abrufen der Kinderliste:', error);
            return [];
        }
        return data;
    };


    /**
     * Ruft die Kinder einer bestimmten Gruppe ab.
     * @param {number} groupId - ID der Gruppe
     */
    const fetchChildrenByGroup = async (groupId) => {
        const { data, error } = await supabase
            .from('children')
            .select('id, name, age, band_id')
            .eq('group_id', groupId)
            .order('id', { ascending : true });

        if (error) {
            console.error('Fehler beim Abrufen der Kinder der Gruppe:', error);
            throw new Error(error.message);
        }
        return data;
    };

    /**
     * Ticket 133 - reales Pendant zu useChildEntityMock.getChildById(): ein
     * Kind anhand der id, Feldnamen an ChildDetailView.vue orientiert.
     * parentA/parentB/phone aus dem Mock existieren in der echten Tabelle
     * nicht (tickets/133/133.txt, "Что не входит").
     * @param {number} id - ID des Kindes
     */
    const getChildById = async (id) => {
        const { data, error } = await supabase
            .from('children')
            .select('id, name, age, schwimmer, notes, group_id, band_id, bus_id, last_scan_at')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Fehler beim Abrufen des Kindes:', error);
            throw new Error(error.message);
        }
        if (!data) return null;

        return {
            id : data.id,
            name : data.name,
            age : data.age,
            groupId : data.group_id,
            busId : data.bus_id,
            schwimmer : data.schwimmer,
            band_id : data.band_id,
            notes : data.notes && data.notes !== '""' ? data.notes : '',
            last_scan_at : data.last_scan_at
        };
    };

    /**
     * Ticket 133 - reales Pendant zu useChildEntityMock.getChildrenByGroup():
     * Kurzform {id,name,groupId} fuer ChildLink/EntityListCard (camelCase
     * groupId, wie im uebernommenen Prototyp-Markup erwartet).
     * @param {number} groupId - ID der Gruppe
     */
    const getChildrenByGroup = async (groupId) => {
        const { data, error } = await supabase
            .from('children')
            .select('id, name, group_id')
            .eq('group_id', groupId)
            .order('name', { ascending : true });

        if (error) {
            console.error('Fehler beim Abrufen der Kinder der Gruppe:', error);
            throw new Error(error.message);
        }
        return (data || []).map(c => ({ id : c.id, name : c.name, groupId : c.group_id }));
    };


    /**
     * Ruft eine Liste aller Kinder ab, optional mit Suchbegriff.
     * @param {string} searchTerm - Suchbegriff (Name oder Armband-ID)
     */
    const fetchChildrenList = async (searchTerm = '') => {
        let query = supabase
            .from('children')
            .select('id, name, age, group_id, schwimmer, band_id, notes')
            .order('name', { ascending : true });

        if (searchTerm) {
            // Suche nach Name (case-insensitive) ODER nach band_id
            query = query.or(`name.ilike.%${searchTerm}%,band_id.eq.${searchTerm}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Fehler beim Abrufen der Kinderliste:', error);
            throw new Error(error.message);
        }
        return data;
    };


    /**
     * Löscht ein Kind anhand der ID.
     * @param {number} childId - ID des Kindes
     */
    const deleteChild = async (childId) => {
        const { error } = await supabase
            .from('children')
            .delete()
            .eq('id', childId);

        if (error) {
            console.error('Fehler beim Löschen des Kindes:', error);
            throw new Error(error.message);
        }
        return true;
    };


    /**
     * Speichert (erstellt oder aktualisiert) die Daten des Kindes.
     * @param {object} childData - Daten des Kindes. Kann 'id' enthalten.
     */
    const saveChild = async (childData) => {
        const { id, band_id, notes, ...payload } = childData; // Извлекаем notes

        const cleanedNotes = notes && notes.trim() !== '' && notes.trim() !== '""' ? notes.trim() : '';

        const finalPayload = {
            ...payload,
            notes : cleanedNotes, // Используем очищенные заметки
            band_id : band_id && !isNaN(parseInt(band_id)) ? parseInt(band_id).toString() : null,
        };

        let query;
        let successMessage;

        if (id) {
            // UPDATE (Bearbeiten)
            query = supabase
                .from('children')
                .update(finalPayload)
                .eq('id', id)
                .select()
                .single();
            successMessage = `Daten des Kindes ${payload.name} wurden aktualisiert.`;
        } else {
            // INSERT (Erstellen)
            query = supabase
                .from('children')
                .insert({ ...finalPayload, created_at : new Date().toISOString() })
                .select()
                .single();
            successMessage = `Kind ${payload.name} wurde erfolgreich erstellt.`;
        }

        const { data, error } = await query;

        if (error) {
            console.error('Fehler beim Speichern der Kinderdaten:', error);
            // Behandlung des Fehlers, wenn der Armbandcode bereits gebunden ist
            if (error.code === '23505') {
                throw new Error(`Fehler: Der Armbandcode "${band_id}" ist bereits einem anderen Kind zugeordnet.`);
            }
            throw new Error(`Speicherfehler: ${error.message}`);
        }

        return { data, message : successMessage };
    };


    return {
        createChildAndBind,
        bindBraceletToExistingChild,
        fetchAllChildren,
        fetchChildrenByGroup,
        fetchChildrenList,
        saveChild,
        deleteChild,
        unbindBracelet,
        getChildById,
        getChildrenByGroup,

    };
}