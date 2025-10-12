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

        // Проверка авторизации:
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("Ошибка авторизации: Вы должны войти в систему. Политика RLS требует статуса 'authenticated'.");
        }

        // Нормализация данных
        const finalPayload = {
            ...payload,
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
                .select(); // <--- УДАЛЕНО .single()
                           // чтобы избежать PGRST116, если RLS блокирует обновление
            successMessage = `День "${payload.date}" обновлен.`;
        } else {
            // INSERT (Создание)
            query = supabase
                .from('days')
                .insert({ ...finalPayload, created_at : new Date().toISOString() })
                .select()
                .single(); // <--- .single() остается для INSERT, так как мы ожидаем одну вставленную строку
            successMessage = `День "${payload.date}" успешно создан.`;
        }

        const { data, error } = await query;

        if (error) {
            console.error('Ошибка при сохранении данных дня:', error);
            if (error.message.includes('violates row-level security policy')) {
                throw new Error(`Ошибка RLS: Доступ запрещен. Убедитесь, что политика RLS для INSERT/UPDATE на таблице 'days' установлена на 'WITH CHECK (true)' для 'authenticated' пользователей.`);
            }
            throw new Error(`Ошибка сохранения: ${error.message}`);
        }

        // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ДЛЯ UPDATE:
        // Если это был UPDATE, и данных нет (data.length === 0), то RLS заблокировала его.
        if (id && (!data || data.length === 0)) {
            throw new Error(`Ошибка RLS: Обновление не выполнено. Политика безопасности не разрешает вам изменять запись с ID ${id}.`);
        }

        // Возвращаем первый элемент (для INSERT это всегда data[0], для UPDATE - data[0])
        return { data: Array.isArray(data) ? data[0] : data, message : successMessage };
    };


    return {
        fetchDaysList,
        saveDay,
        deleteDay,
    };
}