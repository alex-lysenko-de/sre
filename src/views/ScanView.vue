<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// Предполагаем, что у вас есть supabase клиент
import { supabase } from '@/plugins/supabase';
// Предполагаем, что у вас есть заглушки для useAuth
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
// Используем заглушки, пока useAuth не реализован
const useAuthStub = () => ({ currentUserId: ref(1), currentUserRole: ref('user') });
const { currentUserId, currentUserRole } = useAuthStub();

const scanStatus = ref('Ожидание сканирования...');
const childData = ref(null);
const bandId = ref(null); // Изменили название переменной на bandId (BigInt)

// Логика из Тикета 2, адаптированная под новую структуру БД
const processScan = async (n) => {
  if (!n) {
    scanStatus.value = 'Ошибка: Код браслета (n) не найден в URL.';
    return;
  }

  // 1. Преобразование кода n в BigInt для band_id
  let nBigInt;
  try {
    nBigInt = BigInt(n);
  } catch (e) {
    scanStatus.value = 'Ошибка: Код браслета не является числом.';
    return;
  }

  bandId.value = nBigInt;
  scanStatus.value = `Обработка кода: ${bandId.value}...`;

  // 2. Проверка роли (Acceptance criteria 1)
  // Мы используем 'user' для теста. Если роль guest или не авторизован - редирект.
  if (currentUserRole.value === 'guest' || !currentUserId.value) {
    scanStatus.value = 'Гостевой доступ. Перенаправление на /info...';
    router.replace({ path: '/info', query: { n } });
    return;
  }

  // 3. Поиск ребёнка по band_id в таблице children (Адаптация под новую БД)
  const { data: child, error: childError } = await supabase
      .from('children')
      // Запрашиваем данные о ребёнке, включая номер группы
      .select('*')
      .eq('band_id', bandId.value.toString()) // Supabase может требовать строку для bigint в eq
      .single();

  if (childError && childError.code !== 'PGRST116') { // PGRST116 = Not Found
    // Обработка критической ошибки
    scanStatus.value = `Ошибка запроса к БД: ${childError.message}`;
    return;
  }

  if (!child) {
    // 4. Браслет не привязан (Acceptance criteria 3)
    scanStatus.value = `Браслет ${bandId.value} не привязан. Перенаправление на привязку.`;
    // Перенаправление на BindBraceletView (Тикет 3)
    router.replace({ path: '/main/bind', query: { n: n } });
    return;
  }

  childData.value = child;

  // 5. Создать запись в scans (Acceptance criteria 2)
  scanStatus.value = `Браслет привязан к ${child.name}. Запись скана...`;

  // !!! Здесь должна быть логика дедупликации (Тикет 8) перед вставкой

  const { error: scanInsertError } = await supabase.from('scans').insert({
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    user_id: currentUserId.value,
    child_id: child.id,
    band_id: bandId.value, // Теперь это bigint
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