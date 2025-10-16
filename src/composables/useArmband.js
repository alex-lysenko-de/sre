// src/composables/useArmband.js
import { supabase } from '@/supabase'

export function useArmband() {
    /**
     * Получить статус браслета и привязанного ребенка
     * @param {bigint} bandId - ID браслета
     * @returns {Object|null} Данные ребенка или null если браслет не привязан
     */
    const getBraceletStatus = async (bandId) => {
        try {
            const { data, error } = await supabase
                .from('children')
                .select('id, name, age, group_id, band_id, schwimmer, notes')
                .eq('band_id', bandId)
                .maybeSingle()

            if (error) throw error

            return data // null если браслет не привязан
        } catch (err) {
            console.error('Fehler beim Abrufen des Armband-Status:', err)
            throw err
        }
    }

    /**
     * Получить список детей по группе воспитателя
     * @param {number} groupId - ID группы
     * @returns {Array} Список детей
     */
    const getChildrenByGroup = async (groupId) => {
        try {
            const { data, error } = await supabase
                .from('children')
                .select('id, name, age, band_id, schwimmer')
                .eq('group_id', groupId)
                .order('name', { ascending: true })

            if (error) throw error

            return data || []
        } catch (err) {
            console.error('Fehler beim Abrufen der Kinder nach Gruppe:', err)
            throw err
        }
    }

    /**
     * Получить подробные данные о ребенке
     * @param {number} childId - ID ребенка
     * @returns {Object} Данные ребенка
     */
    const getChildDetails = async (childId) => {
        try {
            const { data, error } = await supabase
                .from('children')
                .select('*')
                .eq('id', childId)
                .single()

            if (error) throw error

            return data
        } catch (err) {
            console.error('Fehler beim Abrufen der Kinderdaten:', err)
            throw err
        }
    }

    /**
     * Проверить, привязан ли браслет к другому ребенку
     * @param {bigint} bandId - ID браслета
     * @returns {Object|null} Данные ребенка или null если браслет свободен
     */
    const checkBraceletAlreadyBound = async (bandId) => {
        try {
            const { data, error } = await supabase
                .from('children')
                .select('id, name')
                .eq('band_id', bandId)
                .maybeSingle()

            if (error) throw error

            return data // null если браслет свободен
        } catch (err) {
            console.error('Fehler beim Prüfen der Armband-Bindung:', err)
            throw err
        }
    }

    /**
     * Привязать браслет к ребенку
     * @param {number} childId - ID ребенка
     * @param {bigint} bandId - ID браслета
     * @returns {Object} Обновленные данные ребенка
     */
    const assignBraceletToChild = async (childId, bandId) => {
        try {
            // Проверяем, не привязан ли браслет к другому ребенку
            const existingChild = await checkBraceletAlreadyBound(bandId)

            if (existingChild) {
                throw new Error(
                    `Fehler: Der Armband ist bereits dem Kind "${existingChild.name}" zugeordnet. ` +
                    `Bitte zuerst den Armband entfernen oder ein neues Armband verwenden.`
                )
            }

            // Привязываем браслет к ребенку
            const { data, error } = await supabase
                .from('children')
                .update({ band_id: bandId })
                .eq('id', childId)
                .select()
                .single()

            if (error) throw error

            console.log(`✅ Armband ${bandId} erfolgreich dem Kind ${data.name} zugeordnet`)
            return data
        } catch (err) {
            console.error('Fehler beim Zuordnen des Armbands:', err)
            throw err
        }
    }

    /**
     * Создать запись в таблице scans (отметить присутствие)
     * @param {number} userId - ID пользователя (воспитателя)
     * @param {number} childId - ID ребенка
     * @param {bigint} bandId - ID браслета
     * @returns {Object} Созданная запись
     */
    const recordChildPresence = async (userId, childId, bandId) => {
        try {
            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('scans')
                .insert({
                    date: today,
                    user_id: userId,
                    child_id: childId,
                    band_id: bandId
                })
                .select()
                .single()

            if (error) throw error

            console.log(`✅ Präsenz für Kind ${childId} registriert`)
            return data
        } catch (err) {
            console.error('Fehler beim Registrieren der Präsenz:', err)
            throw err
        }
    }

    return {
        getBraceletStatus,
        getChildrenByGroup,
        getChildDetails,
        checkBraceletAlreadyBound,
        assignBraceletToChild,
        recordChildPresence
    }
}