<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// Предполагаем, что у вас есть supabase клиент
import { supabase } from '@/plugins/supabase';
// Предполагаем, что у вас есть composable для работы с пользователем/аутентификацией
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const { currentUserId, currentUserRole } = useAuth(); // 'guest', 'user', 'admin'
const scanStatus = ref('Ожидание сканирования...');
const childData = ref(null);
const bandCode = ref(null);

// Логика из Тикета 2
const processScan = async (n) => {
  if (!n) {
    scanStatus.value = 'Ошибка: Код браслета (n) не найден в URL.';
    return;
  }
  bandCode.value = n;
  scanStatus.value = `Обработка кода: ${n}...`;

  // 1. Проверка роли (Acceptance criteria 1)
  if (currentUserRole.value === 'guest' || !currentUserId.value) {
    scanStatus.value = 'Гостевой доступ. Перенаправление на /info...';
    // Редирект для guest - никаких записей в БД
    router.replace({ path: '/info', query: { n } });
    return;
  }

  // 2. Логика для user/admin

  // 2a. Найти браслет по коду (n)
  const { data: band, error: bandError } = await supabase
      .from('c_bands')
      .select('id, child_id') // Если child_id уже есть в bands
      .eq('code', n)
      .single();

  if (bandError || !band) {
    // Браслет не найден, или ошибка запроса
    scanStatus.value = `Ошибка: Браслет с кодом ${n} не найден.`;
    // Здесь может быть UI для создания браслета, если он новый.
    return;
  }

  // 2b. Проверка привязки (Acceptance criteria 3)
  // Используем band.child_id, если он есть в таблице c_bands, иначе ищем в children
  let child = null;

  if (band.child_id) {
    // Браслет уже привязан к ребёнку (если band.child_id есть)
    const { data: cData } = await supabase
        .from('children')
        .select('*, groups(name)')
        .eq('id', band.child_id)
        .single();
    child = cData;
  } else {
    // Ищем ребёнка по band_id, как в примере из Тикета
    const { data: cData } = await supabase
        .from('children')
        .select('*, groups(name)')
        .eq('band_id', band.id)
        .single();
    child = cData;
  }


  if (!child) {
    scanStatus.value = `Браслет ${n} не привязан.`;
    // Перенаправление на BindBraceletView
    router.replace({ path: '/main/bind', query: { n } });
    return;
  }

  childData.value = child;

  // 3. Создать запись в scans (Acceptance criteria 2)
  scanStatus.value = `Браслет привязан к ${child.name}. Запись скана...`;

  // !!! Добавить логику дедупликации (Тикет 8) перед вставкой

  const { error: scanInsertError } = await supabase.from('scans').insert({
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    user_id: currentUserId.value,
    child_id: child.id,
    band_id: band.id,
    type: 1 // 'present'
  });

  if (scanInsertError) {
    console.error('Ошибка вставки скана:', scanInsertError);
    // Обработка ошибки, например, если это дубликат (Тикет 8)
    scanStatus.value = `Скан не записан. Ошибка: ${scanInsertError.message}`;
  } else {
    scanStatus.value = `✅ Успешно! Скан ребёнка ${child.name} записан.`;
  }
};


onMounted(() => {
  const n = route.query.n;
  if (n) {
    processScan(n);
  } else {
    scanStatus.value = 'Готов к сканированию. Отсканируйте QR-код.';
  }
});
</script>

<template>
  <div class="scan-view p-4">
    <h3 class="text-xl font-semibold mb-4">Поток Сканирования</h3>

    <div :class="['p-4 rounded-lg shadow-md', scanStatus.startsWith('Ошибка') ? 'bg-red-100 text-red-700' : scanStatus.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700']">
      {{ scanStatus }}
    </div>

    <div v-if="childData" class="mt-6 p-4 border rounded-lg bg-white shadow-sm">
      <h4 class="text-lg font-bold">{{ childData.name }} ({{ childData.age }} лет)</h4>
      <p>Группа: <span class="font-medium">{{ childData.groups ? childData.groups.name : '—' }}</span></p>
      <p>Статус: {{ childData.schwimmer ? 'Пловец 🏊' : 'Не пловец' }}</p>
      <p class="text-sm mt-2 text-gray-500">Браслет: {{ bandCode }}</p>

      <button @click="router.push(`/main/child/${childData.id}`)" class="mt-3 text-indigo-600 hover:text-indigo-800 text-sm">
        Перейти к карточке ребёнка
      </button>
    </div>

    <div v-if="!bandCode && scanStatus === 'Готов к сканированию. Отсканируйте QR-код.'" class="mt-6">
      <label for="manual-scan" class="block text-sm font-medium text-gray-700">Ручной ввод кода браслета:</label>
      <div class="mt-1 flex space-x-2">
        <input
            type="text"
            id="manual-scan"
            v-model="bandCode"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            placeholder="Введите код (напр., 001)"
        />
        <button
            @click="processScan(bandCode)"
            class="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Сканировать
        </button>
      </div>
    </div>
  </div>
</template>