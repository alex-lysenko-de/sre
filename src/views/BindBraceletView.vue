<script setup>
import { onMounted, ref, reactive, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChildren } from '@/composables/useChildren';
// Допустим, у вас есть composable для уведомлений
// import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const { createChildAndBind, bindBraceletToExistingChild, fetchAllChildren } = useChildren();
// const toast = useToast();

const bandId = ref(null);
const loading = ref(true);
const statusMessage = ref('');
const allChildren = ref([]);

// --- Состояние для Опции 1: Привязать к существующему ---
const selectedChildId = ref(null);
const isBindingToExisting = ref(false);

// --- Состояние для Опции 2: Создать нового ---
const newChildForm = reactive({
  name: '',
  age: 0,
  schwimmer: false,
  group_id: 1, // Группа по умолчанию
});
const isCreatingNew = ref(false);


const fetchInitialData = async () => {
  const n = route.query.n;
  if (!n) {
    statusMessage.value = 'Ошибка: Код браслета не найден для привязки.';
    loading.value = false;
    return;
  }

  // Преобразуем 'n' в bigint, если это возможно, или работаем как с text/varchar
  // В текущей структуре БД band_id - bigint, поэтому преобразуем
  const parsedBandId = BigInt(n);
  if (parsedBandId <= 0) {
    statusMessage.value = 'Ошибка: Некорректный код браслета.';
    loading.value = false;
    return;
  }

  bandId.value = parsedBandId;
  statusMessage.value = `Готовность к привязке браслета: ${bandId.value}`;

  // Загрузка списка существующих детей
  allChildren.value = await fetchAllChildren();

  loading.value = false;
};

// --- Методы привязки ---

const handleBindToExisting = async () => {
  if (!selectedChildId.value || !bandId.value) {
    statusMessage.value = 'Выберите ребенка для привязки.';
    return;
  }
  isBindingToExisting.value = true;
  statusMessage.value = `Привязка браслета ${bandId.value} к ребенку...`;

  try {
    const child = await bindBraceletToExistingChild(selectedChildId.value, bandId.value);
    statusMessage.value = `✅ Успех! Браслет привязан к ${child.name}.`;
    // toast.success(...)

    // Переход в ScanView для записи скана
    router.replace({ path: '/main/scan', query: { n: bandId.value.toString() } });
  } catch (e) {
    statusMessage.value = `Ошибка привязки: ${e.message}`;
    console.error(e);
    // toast.error(...)
  } finally {
    isBindingToExisting.value = false;
  }
};


const handleCreateNewChild = async () => {
  if (!newChildForm.name || !bandId.value) {
    statusMessage.value = 'Заполните имя и убедитесь, что код браслета присутствует.';
    return;
  }
  isCreatingNew.value = true;
  statusMessage.value = `Создание ребенка и привязка браслета ${bandId.value}...`;

  try {
    const child = await createChildAndBind(newChildForm, bandId.value);
    statusMessage.value = `✅ Успех! Создан ${child.name} и привязан браслет.`;
    // toast.success(...)

    // Переход в ScanView для записи скана
    router.replace({ path: '/main/scan', query: { n: bandId.value.toString() } });
  } catch (e) {
    statusMessage.value = `Ошибка создания: ${e.message}`;
    console.error(e);
    // toast.error(...)
  } finally {
    isCreatingNew.value = false;
  }
};

onMounted(fetchInitialData);
</script>

<template>
  <div class="bind-bracelet-view p-4">
    <h3 class="text-xl font-semibold mb-4">Привязка браслета</h3>

    <div v-if="loading" class="text-indigo-600">Загрузка данных...</div>

    <div v-else>
      <div :class="['p-3 rounded-lg mb-6', statusMessage.startsWith('Ошибка') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700']">
        Браслет: <span class="font-bold">{{ bandId }}</span>.
        {{ statusMessage }}
      </div>

      <div class="p-6 border rounded-lg shadow-md mb-6 bg-white">
        <h4 class="text-lg font-bold mb-3">1. Привязать к существующему</h4>

        <select
            v-model="selectedChildId"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 mb-4"
        >
          <option :value="null" disabled>-- Выберите ребенка --</option>
          <option v-for="child in allChildren" :key="child.id" :value="child.id">
            {{ child.name }} (Группа: {{ child.group_id || 'Нет' }})
          </option>
        </select>

        <button
            @click="handleBindToExisting"
            :disabled="!selectedChildId || isBindingToExisting"
            :class="['w-full py-2 rounded-md text-white font-semibold transition-colors',
                             !selectedChildId || isBindingToExisting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700']"
        >
          {{ isBindingToExisting ? 'Привязка...' : 'Привязать браслет' }}
        </button>
      </div>

      <div class="p-6 border rounded-lg shadow-md bg-white">
        <h4 class="text-lg font-bold mb-3">2. Создать нового ребенка и привязать</h4>

        <form @submit.prevent="handleCreateNewChild" class="space-y-3">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Имя:</label>
            <input type="text" id="name" v-model="newChildForm.name" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
          </div>
          <div>
            <label for="age" class="block text-sm font-medium text-gray-700">Возраст:</label>
            <input type="number" id="age" v-model.number="newChildForm.age" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
          </div>
          <div>
            <label for="group_id" class="block text-sm font-medium text-gray-700">Группа (номер):</label>
            <input type="number" id="group_id" v-model.number="newChildForm.group_id" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
          </div>
          <div class="flex items-center">
            <input type="checkbox" id="schwimmer" v-model="newChildForm.schwimmer" class="h-4 w-4 text-indigo-600 border-gray-300 rounded">
            <label for="schwimmer" class="ml-2 block text-sm text-gray-900">Пловец (Schwimmer)</label>
          </div>

          <button
              type="submit"
              :disabled="!newChildForm.name || isCreatingNew"
              :class="['w-full py-2 rounded-md text-white font-semibold transition-colors',
                                 !newChildForm.name || isCreatingNew ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700']"
          >
            {{ isCreatingNew ? 'Создание...' : 'Создать и Привязать Браслет' }}
          </button>
        </form>
      </div>

      <button @click="router.push('/main/scan')" class="mt-6 text-sm text-gray-500 hover:text-indigo-600">
        ← Назад к сканированию
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Стилевые настройки можно дополнить с помощью Tailwind */
</style>