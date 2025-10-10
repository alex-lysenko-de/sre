<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useChildren } from '@/composables/useChildren';

const router = useRouter();
const { fetchChildrenList } = useChildren();

const childrenList = ref([]);
const loading = ref(true);
const searchTerm = ref('');
const error = ref(null);

const fetchList = async (term) => {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchChildrenList(term);
    childrenList.value = data;
  } catch (e) {
    error.value = 'Не удалось загрузить список детей: ' + e.message;
    childrenList.value = [];
  } finally {
    loading.value = false;
  }
};

// Запуск поиска при изменении поля (в реальном приложении рекомендуется использовать debounce)
watch(searchTerm, (newTerm) => {
  fetchList(newTerm);
});

const goToDetail = (childId) => {
  router.push({ name: 'ChildDetail', params: { id: childId } });
};

onMounted(() => {
  fetchList();
});
</script>

<template>
  <div class="children-view p-4">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-2xl font-semibold">Список детей ({{ childrenList.length }})</h3>

      <button class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
        + Добавить ребёнка
      </button>
    </div>

    <div class="mb-6">
      <input
          type="search"
          v-model="searchTerm"
          placeholder="Поиск по имени или ID браслета..."
          class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>

    <div v-if="loading" class="text-center py-10">
      <p class="text-indigo-600">Загрузка данных...</p>
    </div>

    <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <strong class="font-bold">Ошибка:</strong>
      <span class="block sm:inline"> {{ error }}</span>
    </div>

    <div v-else-if="childrenList.length === 0" class="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
      <p>Дети не найдены по вашему запросу.</p>
    </div>

    <div v-else class="overflow-x-auto bg-white rounded-lg shadow-xl">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Имя</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Группа</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Браслета</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пловец</th>
          <th class="px-6 py-3"></th>
        </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="child in childrenList" :key="child.id" class="hover:bg-gray-50 cursor-pointer" @click="goToDetail(child.id)">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ child.name }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ child.group_id }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ child.band_id || 'Нет' }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <span :class="['px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                                           child.schwimmer ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
                                {{ child.schwimmer ? 'Да' : 'Нет' }}
                            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <a @click.stop="goToDetail(child.id)" class="text-indigo-600 hover:text-indigo-900">Просмотр</a>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>