<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabase';
// Используем заглушки, пока useAuth не реализован
const useAuthStub = () => ({ currentUserId: ref(1), currentUserRole: ref('user') });
const { currentUserId, currentUserRole } = useAuthStub();

const scanStatus = ref('Ожидание сканирования...');
const childData = ref(null);
const bandId = ref(null);

const processScan = async (n) => {
  if (!n) {
    scanStatus.value = 'Ошибка: Код браслета (n) не найден в URL.';
    return;
  }

  let nBigInt;
  try {
    nBigInt = BigInt(n);
  } catch (e) {
    scanStatus.value = 'Ошибка: Код браслета не является числом.';
    return;
  }

  bandId.value = nBigInt;
  scanStatus.value = `Обработка кода: ${bandId.value}...`;

  if (currentUserRole.value === 'guest' || !currentUserId.value) {
    scanStatus.value = 'Гостевой доступ. Перенаправление на /info...';
    router.replace({ path: '/info', query: { n } });
    return;
  }

  // 1. Поиск ребёнка по band_id
  const { data: child, error: childError } = await supabase
      .from('children')
      .select('*')
      .eq('band_id', bandId.value.toString())
      .single();

  if (childError && childError.code !== 'PGRST116') {
    scanStatus.value = `Ошибка запроса к БД: ${childError.message}`;
    return;
  }

  if (!child) {
    scanStatus.value = `Браслет ${bandId.value} не привязан. Перенаправление на привязку.`;
    router.replace({ path: '/main/bind', query: { n: n } });
    return;
  }

  childData.value = child;
  scanStatus.value = `Браслет привязан к ${child.name}. Запись скана...`;

  // 2. Создать запись в scans (ВСЕГДА вставляем, без проверки дубликатов)

  const { error: scanInsertError } = await supabase.from('scans').insert({
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    user_id: currentUserId.value,
    child_id: child.id,
    band_id: bandId.value,
    type: 1 // 'present'
  });

  if (scanInsertError) {
    console.error('Ошибка вставки скана:', scanInsertError);
    scanStatus.value = `Скан не записан. Ошибка: ${scanInsertError.message}`;
  } else {
    // Успешный, но нейтральный ответ (поскольку могут быть и другие сканы)
    scanStatus.value = `✅ Скан ребёнка ${child.name} успешно записан (сырые данные).`;
  }
};

// ... (onMounted и остальная часть <template> без изменений)
</script>

<template>
  <div class="scan-view p-4">
    <h3 class="text-xl font-semibold mb-4">Поток Сканирования</h3>

    <div :class="['p-4 rounded-lg shadow-md', scanStatus.startsWith('Ошибка') ? 'bg-red-100 text-red-700' : scanStatus.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700']">
      {{ scanStatus }}
    </div>

    <div v-if="childData" class="mt-6 p-4 border rounded-lg bg-white shadow-sm">
      <h4 class="text-lg font-bold">{{ childData.name }} ({{ childData.age }} лет)</h4>
      <p>Группа: <span class="font-medium">{{ childData.group_id || '—' }}</span></p>
      <p>Статус: {{ childData.schwimmer ? 'Пловец 🏊' : 'Не пловец' }}</p>
      <p class="text-sm mt-2 text-gray-500">Браслет ID: {{ bandId }}</p>

      <button @click="router.push(`/main/child/${childData.id}`)" class="mt-3 text-indigo-600 hover:text-indigo-800 text-sm">
        Перейти к карточке ребёнка
      </button>
    </div>

    <div v-if="!bandId && scanStatus === 'Готов к сканированию. Отсканируйте QR-код.'" class="mt-6">
      <label for="manual-scan" class="block text-sm font-medium text-gray-700">Ручной ввод кода браслета:</label>
      <div class="mt-1 flex space-x-2">
        <input
            type="text"
            id="manual-scan"
            v-model="bandId"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            placeholder="Введите код (напр., 1001)"
        />
        <button
            @click="processScan(bandId.toString())"
            class="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Сканировать
        </button>
      </div>
    </div>
  </div>
</template>