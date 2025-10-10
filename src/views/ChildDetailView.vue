<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChildren } from '@/composables/useChildren';
import { supabase } from '@/plugins/supabase'; // Импорт supabase для unbindBracelet

const route = useRoute();
const router = useRouter();
const { fetchChildDetailsAndScans } = useChildren();

const childData = ref(null);
const scanHistory = ref([]);
const loading = ref(true);
const error = ref(null);
const childId = ref(null);

const fetchData = async () => {
  childId.value = route.params.id;
  if (!childId.value) {
    error.value = 'ID ребенка не указан.';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const result = await fetchChildDetailsAndScans(childId.value);
    childData.value = result.child;
    scanHistory.value = result.scans;
  } catch (e) {
    error.value = 'Не удалось загрузить данные: ' + e.message;
    childData.value = null;
  } finally {
    loading.value = false;
  }
};

/**
 * Отвязывает браслет от текущего ребенка
 */
const unbindBracelet = async () => {
  if (!childData.value || !confirm(`Вы уверены, что хотите отвязать браслет ${childData.value.band_id} от ${childData.value.name}?`)) {
    return;
  }

  try {
    const { error: updateError } = await supabase
        .from('children')
        .update({ band_id: null }) // Устанавливаем band_id в NULL
        .eq('id', childId.value);

    if (updateError) throw new Error(updateError.message);

    alert(`Браслет ${childData.value.band_id} отвязан.`);
    childData.value.band_id = null; // Обновляем локально
  } catch (e) {
    alert(`Ошибка отвязки: ${e.message}`);
    console.error(e);
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="child-detail-view p-4">
    <button @click="router.push('/main/children')" class="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center font-medium">
      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
      К списку детей
    </button>

    <div v-if="loading" class="text-center py-10 text-indigo-600">Загрузка данных...</div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 p-4 rounded-lg mb-6">
      <strong class="font-bold">Ошибка:</strong> {{ error }}
    </div>

    <div v-else-if="childData" class="space-y-8">
      <div class="bg-white p-6 rounded-lg shadow-xl border-t-4 border-indigo-500">
        <h3 class="text-3xl font-bold mb-4">{{ childData.name }}</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="detail-item">
            <p class="text-sm font-medium text-gray-500">Возраст</p>
            <p class="text-lg font-semibold text-gray-900">{{ childData.age }} лет</p>
          </div>
          <div class="detail-item">
            <p class="text-sm font-medium text-gray-500">Группа</p>
            <p class="text-lg font-semibold text-gray-900">{{ childData.group_id || 'Не указана' }}</p>
          </div>
          <div class="detail-item">
            <p class="text-sm font-medium text-gray-500">Статус</p>
            <p :class="['text-lg font-semibold', childData.schwimmer ? 'text-green-600' : 'text-red-600']">
              {{ childData.schwimmer ? 'Пловец 🏊' : 'Не пловец' }}
            </p>
          </div>
          <div class="detail-item">
            <p class="text-sm font-medium text-gray-500">Браслет ID</p>
            <div class="flex items-center space-x-2">
              <p class="text-lg font-semibold text-gray-900">{{ childData.band_id || 'Не привязан' }}</p>
              <button v-if="childData.band_id" @click.stop="unbindBracelet" title="Отвязать браслет" class="text-red-500 hover:text-red-700 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 border-t pt-4">
          <p class="text-sm font-medium text-gray-500">Заметки</p>
          <p class="text-gray-700 italic">{{ childData.notes || 'Заметок нет.' }}</p>
        </div>
      </div>

      ---

      <div>
        <h4 class="text-2xl font-semibold mb-4">История сканирования</h4>

        <div v-if="scanHistory.length === 0" class="p-6 bg-gray-100 rounded-lg text-gray-600">
          Нет записей сканирования для этого ребенка.
        </div>

        <div v-else class="overflow-x-auto bg-white rounded-lg shadow-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата и время</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип скана</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Сотрудника</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bus ID</th>
            </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="scan in scanHistory" :key="scan.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ new Date(scan.created_at).toLocaleString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {{ scan.type_name }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ scan.user_id || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ scan.bus_id || '—' }}
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>