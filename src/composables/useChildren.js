// src/composables/useChildren.js
import { supabase } from '@/supabase';

export function useChildren() {

    /**
     * Erstellt ein neues Kind und bindet einen Armbandcode.
     * @param {object} childData - { name, age, schwimmer, group_id }
     * @param {bigint} bandId - Armbandcode (n)
     */
    const createChildAndBind = async (childData, bandId) => {
        const payload = {
            ...childData,
            band_id: bandId,
            created_at: new Date().toISOString(),
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
        const { data: existingChild, error: checkError } = await supabase
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
            .update({ band_id: bandId })
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
            .update({ band_id: null })
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
            .order('name', { ascending: true });

        if (error) {
            console.error('Fehler beim Abrufen der Kinderliste:', error);
            return [];
        }
        return data;
    };


    /**
     * Ruft eine Liste aller Kinder ab, optional mit Suchbegriff.
     * @param {string} searchTerm - Suchbegriff (Name oder Armband-ID)
     */
    const fetchChildrenList = async (searchTerm = '') => {
        let query = supabase
            .from('children')
            .select('id, name, age, group_id, schwimmer, band_id, notes')
            .order('name', { ascending: true });

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
     * Ruft Details des Kindes und die Scan-Historie ab.
     * @param {number} childId - ID des Kindes
     */
    const fetchChildDetailsAndScans = async (childId) => {
        const { data: child, error: childError } = await supabase
            .from('children')
            .select('*')
            .eq('id', childId)
            .single();

        if (childError) {
            throw new Error(`Fehler beim Abrufen der Kinderdaten: ${childError.message}`);
        }

        const { data: scans, error: scansError } = await supabase
            .from('scans')
            .select('*')
            .eq('child_id', childId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (scansError) {
            console.error('Fehler beim Abrufen der Scan-Historie:', scansError);
        }

        const scanTypeMap = { 1: 'Präsenz', 2: 'Bus (Einstieg)', 3: 'Bus (Ausstieg)' };
        const formattedScans = (scans || []).map(scan => ({
            ...scan,
            type_name: scanTypeMap[scan.type] || 'Unbekannt'
        }));


        return { child, scans: formattedScans };
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
        const { id, band_id, ...payload } = childData;

        // band_id: Konvertiert in BigInt-String oder setzt auf null, falls leer
        const finalPayload = {
            ...payload,
            band_id: band_id && !isNaN(parseInt(band_id)) ? parseInt(band_id).toString() : null,
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
                .insert({ ...finalPayload, created_at: new Date().toISOString() })
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

        return { data, message: successMessage };
    };


    return {
        createChildAndBind,
        bindBraceletToExistingChild,
        fetchAllChildren,
        fetchChildrenList,
        fetchChildDetailsAndScans,
        saveChild,
        deleteChild,
        unbindBracelet,

    };
}