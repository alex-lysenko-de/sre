<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'calendar-alt']" />
          Список дней
        </h3>
        <p class="mb-0 mt-2">{{ formattedCurrentDate }}</p>
      </div>
      <div class="card-body">
        <div id="alertContainer"></div>

        <div v-if="loadingInitialData || configLoading" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Загрузка...</span>
          </div>
          <p class="text-muted">Загрузка {{ configLoading ? 'конфигурации' : 'данных о днях' }}...</p>
        </div>

        <div v-else-if="configError" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" />
          <h5 class="text-muted">Не удалось загрузить конфигурацию.</h5>
          <p class="text-muted">Ошибка: {{ configError.message }}. Используются значения по умолчанию.</p>
        </div>

        <div v-else>
          <ul class="list-group list-group-flush children-list">
            <li v-if="days.length === 0" class="list-group-item text-center text-muted">
              Нет сохраненных дней.
            </li>

            <li v-for="day in days" :key="day.id" class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{{ day.date }}</strong> - {{ day.name || 'Без названия' }}
                <span class="badge bg-primary ms-2">{{ day.abfahrt }} - {{ day.ankommen }}</span>
                <p v-if="day.description" class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Описание: {{ day.description.substring(0, 50) + (day.description.length > 50 ? '...' : '') }}
                </p>
                <p v-else class="text-muted mb-0 mt-1" style="font-size: 0.9em;">
                  Нет описания
                </p>
              </div>

              <div class="d-flex">
                <button class="btn btn-outline-primary btn-sm me-2" @click="editDay(day.id)" title="Редактировать день">
                  <font-awesome-icon :icon="['fas', 'edit']" />
                </button>
                <button class="btn btn-outline-danger btn-sm" @click="removeDay(day.id, day.date)" title="Удалить день">
                  <font-awesome-icon :icon="['fas', 'trash-alt']" />
                </button>
              </div>
            </li>
          </ul>

          <div class="d-grid gap-2 mt-4">
            <button class="btn btn-secondary btn-lg" @click="goBack" disabled>
              <font-awesome-icon :icon="['fas', 'arrow-left']" />
              Назад (Неактивно)
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'calendar-plus']" />
          {{ editingDayId !== null ? 'Редактировать день:' : 'Добавить / Редактировать день' }}
        </h3>
      </div>
      <div class="card-body">
        <div id="formAlertContainer"></div>

        <form @submit.prevent="saveDay">

          <div class="mb-3">
            <label for="newDayDate" class="form-label">Дата (public.days.date) <span class="text-danger">*</span></label>
            <input
                type="date"
                id="newDayDate"
                class="form-control"
                v-model="newDayDate"
                required
            >
          </div>

          <div class="mb-3">
            <label for="newDayName" class="form-label">Название (public.days.name)</label>
            <input
                type="text"
                id="newDayName"
                class="form-control"
                v-model="newDayName"
                placeholder="Например, 'Поездка в зоопарк'"
            >
          </div>

          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="newDayAbfahrt" class="form-label">Время отправления (public.days.abfahrt) <span class="text-danger">*</span></label>
              <input
                  type="time"
                  id="newDayAbfahrt"
                  class="form-control"
                  v-model="newDayAbfahrt"
                  required
              >
            </div>
            <div class="col-md-6 mb-3">
              <label for="newDayAnkommen" class="form-label">Время прибытия (public.days.ankommen) <span class="text-danger">*</span></label>
              <input
                  type="time"
                  id="newDayAnkommen"
                  class="form-control"
                  v-model="newDayAnkommen"
                  required
              >
            </div>
          </div>

          <div class="mb-4">
            <label for="newDayDescription" class="form-label">Описание (public.days.description)</label>
            <textarea
                id="newDayDescription"
                class="form-control"
                v-model="newDayDescription"
                rows="3"
                placeholder="Подробности о мероприятиях дня"
            ></textarea>
          </div>

          <div class="d-flex justify-content-between">
            <button type="submit" class="btn btn-primary btn-lg flex-grow-1 me-2" :disabled="configLoading">
              <font-awesome-icon :icon="['fas', editingDayId !== null ? 'save' : 'plus']" />
              {{ editingDayId !== null ? 'Сохранить' : 'Добавить' }}
            </button>
            <button v-if="editingDayId !== null" type="button" class="btn btn-outline-secondary btn-lg" @click="cancelEdit">
              Отменить
            </button>
            <button v-else type="button" class="btn btn-outline-secondary btn-lg" @click="resetForm">
              <font-awesome-icon :icon="['fas', 'eraser']" />
              Очистить
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
// --- ИСПОЛЬЗУЕМ ВАШ config.js ---
import { useConfig } from '@/modules/config'; // Предполагаем путь '@/config'
// ---------------------------------

import { useDays } from '@/composables/useDays';


// --- Утилиты для стилей и уведомлений (взяты из GroupEditView.vue) ---
const Utils = {
  showAlert(message, type = 'info', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;

    alertContainer.innerHTML = '';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  },
  getCurrentDateString() {
    // Формат 'yyyy-mm-dd', как требуется для public.days.date по умолчанию
    return new Date().toISOString().split('T')[0];
  },
  formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  },
};

export default {
  name: 'DaysEditView',

  setup() {
    // Использование созданных нами composables
    const { fetchDaysList, saveDay, deleteDay } = useDays();
    // Получение реактивного состояния конфига и функции загрузки
    const { config, loadConfig, loading: configLoading, error: configError } = useConfig();

    return {
      fetchDaysList, saveDay, deleteDay,
      // Добавляем функции и состояние конфига в контекст компонента
      config, loadConfig, configLoading, configError
    };
  },

  data() {
    return {
      // isConfigLoaded теперь можно заменить на !this.configLoading && !this.configError,
      // но для соответствия GroupEditView.vue оставим флаг, который мы будем устанавливать
      isConfigLoaded: true,
      loadingInitialData: true,

      // Данные для полей формы Days
      newDayDate: Utils.getCurrentDateString(), // По умолчанию текущая дата
      newDayName: '',
      newDayAbfahrt: '', // По умолчанию из config.value("abfahrt_time")
      newDayAnkommen: '', // По умолчанию из config.value("ankommen_time")
      newDayDescription: '',

      // Состояние для редактирования
      editingDayId: null,

      formattedCurrentDate: '',
      days: [], // Список дней
    };
  },

  async created() {
    this.formattedCurrentDate = Utils.formatDateForDisplay(Utils.getCurrentDateString());

    // 1. Сначала загружаем конфигурацию
    await this.loadConfig(); // loadConfig из useConfig

    // 2. Устанавливаем дефолты и загружаем данные о днях
    this.setDefaultsFromConfig();
    await this.loadInitialData();
  },

  methods: {
    showAlert: Utils.showAlert,

    /**
     * Устанавливает значения abfahrt и ankommen по умолчанию из реактивного объекта config.
     */
    setDefaultsFromConfig() {
      // config — это реактивный объект (Proxy), который содержит данные из configData
      const abfahrtTime = this.config.abfahrt_time;
      const ankommenTime = this.config.ankommen_time;

      // Применяем их только если нет активного редактирования,
      // чтобы не перезатереть значения при редактировании.
      if (this.editingDayId === null) {
        this.newDayAbfahrt = abfahrtTime || '08:00';
        this.newDayAnkommen = ankommenTime || '17:00';
      }

      // Установка isConfigLoaded для отображения UI
      this.isConfigLoaded = !this.configError;

      if (this.configError) {
        this.showAlert(`Ошибка при загрузке конфигурации: ${this.configError.message}. Использованы значения по умолчанию (08:00/17:00).`, 'warning');
      } else if (!abfahrtTime || !ankommenTime) {
        // Показываем предупреждение, если в конфиге нет нужных ключей, но ошибка загрузки не произошла
        this.showAlert(`Ключи abfahrt_time или ankommen_time не найдены в конфигурации Supabase. Использованы значения по умолчанию (08:00/17:00).`, 'warning');
      }
    },

    async loadInitialData() {
      this.loadingInitialData = true;

      try {
        const data = await this.fetchDaysList(); // fetchDaysList из useDays.js
        this.days = data;
        this.showAlert(`Данные о днях загружены из Supabase.`, 'info');
      } catch (error) {
        this.showAlert(`Ошибка при загрузке данных о днях: ${error.message}`, 'danger');
      } finally {
        this.loadingInitialData = false;
      }
    },

    resetForm() {
      this.editingDayId = null;
      this.newDayDate = Utils.getCurrentDateString();
      this.newDayName = '';
      this.newDayDescription = '';
      // Сбрасываем время на дефолтное из конфига
      this.setDefaultsFromConfig();
    },

    cancelEdit() {
      this.resetForm();
      this.showAlert('Редактирование отменено.', 'info', 'formAlertContainer');
    },

    validateDayData() {
      const date = this.newDayDate;
      const abfahrt = this.newDayAbfahrt;
      const ankommen = this.newDayAnkommen;

      if (!date) {
        this.showAlert('Пожалуйста, выберите дату.', 'warning', 'formAlertContainer');
        return false;
      }
      if (!abfahrt || !ankommen) {
        this.showAlert('Пожалуйста, укажите время отправления и прибытия.', 'warning', 'formAlertContainer');
        return false;
      }

      return true;
    },

    async saveDay() {
      if (!this.validateDayData()) {
        return;
      }

      const dayData = {
        date: this.newDayDate,
        name: this.newDayName.trim(),
        abfahrt: this.newDayAbfahrt,
        ankommen: this.newDayAnkommen,
        description: this.newDayDescription.trim(),
      };

      if (this.editingDayId !== null) {
        dayData.id = this.editingDayId;
      }

      try {
        const { data, message } = await this.saveDay(dayData);

        // Обновление данных в локальном массиве
        if (this.editingDayId !== null) {
          const index = this.days.findIndex(d => d.id === this.editingDayId);
          if (index !== -1) {
            this.days.splice(index, 1, data);
          }
        } else {
          this.days.push(data);
        }

        // Сортировка по дате для корректного отображения
        this.days.sort((a, b) => new Date(a.date) - new Date(b.date));

        this.showAlert(message, 'success');
        this.resetForm();
      } catch (error) {
        this.showAlert(`Ошибка при сохранении: ${error.message}`, 'danger', 'formAlertContainer');
      }
    },

    editDay(dayId) {
      this.editingDayId = dayId;
      const dayToEdit = this.days.find(d => d.id === dayId);

      if (dayToEdit) {
        // Заполнение формы
        this.newDayDate = dayToEdit.date;
        this.newDayName = dayToEdit.name || '';
        this.newDayAbfahrt = dayToEdit.abfahrt;
        this.newDayAnkommen = dayToEdit.ankommen;
        this.newDayDescription = dayToEdit.description || '';

        document.getElementById('newDayDate').focus();
        this.showAlert(`День "${dayToEdit.date}" загружен для редактирования.`, 'info', 'formAlertContainer');
      }
    },

    async removeDay(dayId, dayDate) {
      if (confirm(`Вы действительно хотите удалить день "${dayDate}"?`)) {
        try {
          await this.deleteDay(dayId);

          // Локальное удаление
          const index = this.days.findIndex(d => d.id === dayId);
          if (index !== -1) {
            this.days.splice(index, 1);
          }

          if (this.editingDayId === dayId) {
            this.resetForm();
          }

          this.showAlert(`День "${dayDate}" успешно удален.`, 'success');
        } catch (error) {
          this.showAlert(`Ошибка при удалении дня: ${error.message}`, 'danger');
        }
      }
    },

    goBack() {
      alert('Назад-Навигация (Эмуляция): Возврат к предыдущему представлению.');
    }
  }
};
</script>

<style>
.main-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa;
}

.card {
  width: 100%;
  max-width: 650px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card + .card {
  margin-top: 20px;
}

.card-header {
  background-color: #007bff;
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}

.children-list {
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0;
}

.list-group-item {
  padding: 15px 20px;
  font-size: 1.1em;
  transition: background-color 0.3s;
}

.list-group-item:hover {
  background-color: #f1f1f1;
}

.list-group-item .btn {
  margin-left: 10px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.list-group-item .btn-outline-primary {
  color: #007bff;
  border-color: #007bff;
}

.list-group-item .btn-outline-danger {
  color: #dc3545;
  border-color: #dc3545;
}

.btn-secondary {
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #5a6268;
  border-color: #545b62;
}
</style>