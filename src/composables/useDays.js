// src/composables/useDays.js
import { supabase } from '@/supabase'; // Импорт клиента Supabase

export function useDays() {

    /**
     * Получает список всех дней, отсортированный по дате.
     */
    const fetchDaysList = async () => {
        const { data, error } = await supabase
            .from('days')
            .select('id, date, name, abfahrt, ankommen, description')
            .order('date', { ascending : true });

        if (error) {
            console.error('Ошибка при получении списка дней:', error);
            throw new Error(error.message);
        }
        return data;
    };


    /**
     * Удаляет день по ID.
     * @param {number} dayId - ID дня
     */
    const deleteDay = async (dayId) => {
        const { error } = await supabase
            .from('days')
            .delete()
            .eq('id', dayId);

        if (error) {
            console.error('Ошибка при удалении дня:', error);
            throw new Error(error.message);
        }
        return true;
    };


    /**
     * Сохраняет (создает или обновляет) данные дня.
     * @param {object} dayData - Данные дня. Может содержать 'id'.
     */
    const saveDay = async (dayData) => {
        const { id, ...payload } = dayData;

        // Нормализация данных
        const finalPayload = {
            ...payload,
            // Время и описание сохраняются как null, если пустые
            abfahrt: payload.abfahrt || null,
            ankommen: payload.ankommen || null,
            description: payload.description && payload.description.trim() !== '' ? payload.description.trim() : null,
        };

        let query;
        let successMessage;

        if (id) {
            // UPDATE (Редактирование)
            query = supabase
                .from('days')
                .update(finalPayload)
                .eq('id', id)
                .select()
                .single();
            successMessage = `День "${payload.date}" обновлен.`;
        } else {
            // INSERT (Создание)
            query = supabase
                .from('days')
                .insert({ ...finalPayload, created_at : new Date().toISOString() })
                .select()
                .single();
            successMessage = `День "${payload.date}" успешно создан.`;
        }

        const { data, error } = await query;

        if (error) {
            console.error('Ошибка при сохранении данных дня:', error);
            throw new Error(`Ошибка сохранения: ${error.message}`);
        }

        return { data, message : successMessage };
    };


    return {
        fetchDaysList,
        saveDay,
        deleteDay,
    };
}