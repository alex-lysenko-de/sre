// src/composables/useChildren.js
import { supabase } from '@/plugins/supabase'; // Предполагаем, что supabase импортирован

export function useChildren() {

    /**
     * Создает нового ребенка и привязывает к нему код браслета.
     * @param {object} childData - { name, age, schwimmer, group_id }
     * @param {bigint} bandId - Код браслета (n)
     */
    const createChildAndBind = async (childData, bandId) => {
        const payload = {
            ...childData,
            band_id: bandId, // Привязываем браслет
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('children')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Ошибка создания ребенка и привязки:', error);
            throw new Error(error.message);
        }
        return data; // Возвращаем созданного ребенка
    };

    /**
     * Привязывает код браслета к существующему ребенку.
     * @param {number} childId - ID существующего ребенка
     * @param {bigint} bandId - Код браслета (n)
     */
    const bindBraceletToExistingChild = async (childId, bandId) => {
        // Проверяем, не занят ли уже этот band_id
        const { data: existingChild, error: checkError } = await supabase
            .from('children')
            .select('id, name')
            .eq('band_id', bandId)
            .maybeSingle();

        if (checkError) throw new Error(checkError.message);

        if (existingChild) {
            // Если браслет уже привязан к кому-то, необходимо его отвязать
            await unbindBracelet(bandId);
        }

        const { data, error } = await supabase
            .from('children')
            .update({ band_id: bandId }) // Привязываем
            .eq('id', childId)
            .select()
            .single();

        if (error) {
            console.error('Ошибка привязки браслета:', error);
            throw new Error(error.message);
        }
        return data; // Возвращаем обновленного ребенка
    };

    /**
     * Отвязывает браслет от ребенка, который его использовал ранее.
     * (Просто устанавливает band_id = NULL для ребенка с этим браслетом)
     */
    const unbindBracelet = async (bandId) => {
        const { error } = await supabase
            .from('children')
            .update({ band_id: null })
            .eq('band_id', bandId);

        if (error) {
            console.error('Ошибка отвязки старого браслета:', error);
            throw new Error(`Ошибка отвязки старого браслета: ${error.message}`);
        }
        return true;
    }


    /**
     * Получает список всех детей (для селектора).
     */
    const fetchAllChildren = async () => {
        const { data, error } = await supabase
            .from('children')
            .select('id, name, group_id')
            .order('name', { ascending: true });

        if (error) {
            console.error('Ошибка получения списка детей:', error);
            return [];
        }
        return data;
    };


    /**
     * Получает список всех детей с возможностью поиска по имени или ID браслета.
     * @param {string} searchTerm - Строка для поиска
     */
    const fetchChildrenList = async (searchTerm = '') => {
        let query = supabase
            .from('children')
            .select('id, name, age, group_id, schwimmer, band_id')
            .order('name', { ascending: true });

        if (searchTerm) {
            // Поиск по имени (регистронезависимо) ИЛИ по band_id
            query = query.or(`name.ilike.%${searchTerm}%,band_id.eq.${searchTerm}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Ошибка получения списка детей:', error);
            throw new Error(error.message);
        }
        return data;
    };


    /**
     * Получает детали ребенка по ID и его историю сканирования.
     * @param {number} childId - ID ребенка
     */
    const fetchChildDetailsAndScans = async (childId) => {
        // 1. Получаем детали ребенка
        const { data: child, error: childError } = await supabase
            .from('children')
            .select('*')
            .eq('id', childId)
            .single();

        if (childError) {
            throw new Error(`Ошибка получения данных ребенка: ${childError.message}`);
        }

        // 2. Получаем историю сканов
        const { data: scans, error: scansError } = await supabase
            // Запрашиваем все поля, включая user_id и type
            .from('scans')
            .select('*')
            .eq('child_id', childId)
            .order('created_at', { ascending: false })
            .limit(50); // Ограничим 50 последними сканами

        if (scansError) {
            console.error('Ошибка получения истории сканов:', scansError);
        }

        // Для удобства отображения, добавим map для типа скана
        // (Соответствует логике из Тикета 2, т.к. scan_type не используется)
        const scanTypeMap = { 1: 'Присутствие', 2: 'Автобус (Вход)', 3: 'Автобус (Выход)' };
        const formattedScans = (scans || []).map(scan => ({
            ...scan,
            type_name: scanTypeMap[scan.type] || 'Неизвестно'
        }));


        return { child, scans: formattedScans };
    };

    return {
        createChildAndBind,
        bindBraceletToExistingChild,
        fetchAllChildren,
        fetchChildrenList,
        fetchChildDetailsAndScans
    };
}