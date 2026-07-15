# Техническое задание: Модуль учета детей в автобусе (AdminBusView)

## 📋 Описание текущей реализации

### 1. Алгоритм подсчета количества детей

#### 1.1 Источник данных
Дети считаются из таблицы **`children_today`** - это оперативная таблица, которая хранит текущее состояние всех детей на мероприятии.

#### 1.2 Условия подсчета детей
Ребенок учитывается в автобусе, если выполнены **ВСЕ** условия:
```sql
WHERE bus_now IS NOT NULL    -- Ребенок назначен на автобус
  AND presence_now > 0        -- Ребенок физически присутствует СЕЙЧАС
```

#### 1.3 Логика подсчета (useBusData.js:20-107)
```javascript
// 1. Загрузка данных из children_today
const { data: childrenData } = await supabase
    .from('children_today')
    .select('bus_now, child_id')
    .not('bus_now', 'is', null)
    .gt('presence_now', 0)

// 2. Группировка по автобусам
childrenData.forEach(child => {
    const busId = child.bus_now
    if (!kinderByBus[busId]) {
        kinderByBus[busId] = 0
    }
    kinderByBus[busId]++  // Увеличиваем счетчик
})

// 3. Результат: { 1: 15, 2: 18, 3: 12 }
// Где ключ - номер автобуса, значение - количество детей
```

---

### 2. Алгоритм подсчета воспитателей (Betreuer)

#### 2.1 Источник данных
Воспитатели считаются из таблицы **`user_group_day`** с JOIN к таблице **`users`**.

#### 2.2 Условия подсчета воспитателей
Воспитатель учитывается в автобусе, если:
```sql
WHERE day = :текущая_дата          -- Запись на сегодня
  AND isPresentToday = 1           -- Подтвердил присутствие
  AND bus_id IS NOT NULL           -- Назначен на автобус
```

#### 2.3 Логика подсчета (useBusData.js:34-84)
```javascript
// 1. Загрузка данных из user_group_day
const { data: betreuerData } = await supabase
    .from('user_group_day')
    .select(`
        bus_id,
        user_id,
        group_id,
        users!inner(id, display_name)
    `)
    .eq('day', date)
    .eq('isPresentToday', 1)
    .not('bus_id', 'is', null)

// 2. Группировка по автобусам + сбор имен
betreuerData.forEach(betreuer => {
    const busId = betreuer.bus_id
    if (!betreuerByBus[busId]) {
        betreuerByBus[busId] = {
            count: 0,
            names: []
        }
    }
    betreuerByBus[busId].count++
    betreuerByBus[busId].names.push(betreuer.users?.display_name)
})

// 3. Результат:
// {
//   1: { count: 2, names: ['Max', 'Anna'] },
//   2: { count: 3, names: ['Tom', 'Lisa', 'Ben'] }
// }
```

---

### 3. Как фиксируется присутствие детей

#### 3.1 Процесс регистрации ребенка на автобус

**Шаг 1: Сканирование браслета**
- Воспитатель сканирует браслет ребенка через мобильное приложение
- Создается запись в таблице `scans`:
  ```sql
  INSERT INTO scans (
      date, user_id, child_id, band_id, bus_id, type
  ) VALUES (
      '2025-10-19', 5, 42, 123, 1, 1
  )
  ```

**Шаг 2: Автоматическое обновление (Trigger)**
- Срабатывает триггер `on_scan_insert` (doc/db/triggers.md:7-56)
- Триггер выполняет **UPSERT** в таблицу `children_today`:
  ```sql
  INSERT INTO children_today (
      user_id, child_id, group_id,
      presence_today, presence_now,
      bus_today, bus_now
  ) VALUES (
      5, 42, 3,
      1, 1,         -- presence: today=1, now=1
      1, 1          -- bus: today=1, now=1
  )
  ON CONFLICT (child_id) DO UPDATE
      SET presence_now = 1,
          bus_now = EXCLUDED.bus_now,
          user_id = EXCLUDED.user_id;
  ```

**Шаг 3: Обновление счетчиков групп**
- Срабатывает второй триггер `on_children_today_change` (triggers.md:65-108)
- Автоматически обновляется таблица `groups_today`:
  ```sql
  INSERT INTO groups_today (
      user_id, group_id, children_today, children_now
  ) VALUES (
      5, 3, 12, 12
  )
  ON CONFLICT (group_id) DO UPDATE ...
  ```

#### 3.2 Состояния присутствия ребенка

| Поле | Значение | Описание |
|------|----------|----------|
| `presence_today` | 0 | Ребенок НЕ был на мероприятии сегодня |
| `presence_today` | 1 | Ребенок БЫЛ зарегистрирован сегодня (хотя бы один раз) |
| `presence_now` | 0 | Ребенок сейчас НЕ присутствует (после reset) |
| `presence_now` | 1 | Ребенок сейчас присутствует (активная регистрация) |

**Пример сценария:**
```
08:00 - Сканирование браслета: presence_today=1, presence_now=1
12:00 - "Tag starten" (reset):  presence_today=1, presence_now=0
12:30 - Повторный скан:         presence_today=1, presence_now=1
```

---

### 4. Где хранятся данные

#### 4.1 Структура таблиц

**Таблица: `children_today`** (Оперативные данные)
```sql
CREATE TABLE children_today (
    id            bigint PRIMARY KEY,
    user_id       bigint NOT NULL,           -- Кто зарегистрировал
    child_id      bigint NOT NULL UNIQUE,    -- ID ребенка (FK → children)
    group_id      smallint,                  -- Номер группы (1..N)
    presence_today smallint DEFAULT 1,       -- Был ли сегодня (0/1)
    presence_now   smallint DEFAULT 0,       -- Присутствует сейчас (0/1)
    bus_today      smallint,                 -- Автобус утром
    bus_now        smallint                  -- Текущий автобус
);

-- Индекс для быстрого подсчета
CREATE INDEX idx_children_today_bus_presence
    ON children_today(bus_now, presence_now)
    WHERE bus_now IS NOT NULL;
```

**Таблица: `scans`** (История всех сканирований)
```sql
CREATE TABLE scans (
    id         bigint PRIMARY KEY,
    created_at timestamp DEFAULT now(),
    date       varchar NOT NULL,           -- Дата в формате YYYY-MM-DD
    user_id    bigint,                     -- Кто сканировал
    child_id   bigint,                     -- FK → children
    band_id    bigint,                     -- ID браслета
    bus_id     smallint,                   -- Номер автобуса
    type       smallint DEFAULT 1          -- Тип скана
);

-- Индексы для быстрого поиска
CREATE INDEX idx_scans_child_date ON scans(child_id, date);
CREATE INDEX idx_scans_band_date ON scans(band_id, date);
```

**Таблица: `groups_today`** (Счетчики по группам)
```sql
CREATE TABLE groups_today (
    id             bigint PRIMARY KEY,
    user_id        bigint NOT NULL UNIQUE,
    group_id       smallint NOT NULL UNIQUE,
    children_today smallint DEFAULT 0,      -- Всего детей сегодня
    children_now   smallint DEFAULT 0       -- Сейчас присутствуют
);
```

**Таблица: `user_group_day`** (Расписание воспитателей)
```sql
CREATE TABLE user_group_day (
    id              bigint PRIMARY KEY,
    created_at      timestamp DEFAULT now(),
    day             date,                    -- Дата мероприятия
    user_id         bigint,                  -- FK → users
    group_id        smallint,                -- Номер группы
    bus_id          smallint,                -- Номер автобуса
    bMustWorkToday  smallint DEFAULT 0,      -- Должен работать (план)
    isPresentToday  smallint DEFAULT 0,      -- Присутствует физически
    description     varchar
);

-- Индекс для быстрого поиска по дате и автобусу
CREATE INDEX idx_user_group_day_bus_date
    ON user_group_day(day, bus_id, isPresentToday)
    WHERE bus_id IS NOT NULL;
```

#### 4.2 Потоки данных

```
┌─────────────────────────────────────────────────────────┐
│                   РЕГИСТРАЦИЯ РЕБЕНКА                   │
└─────────────────────────────────────────────────────────┘
                         ↓
    Воспитатель сканирует браслет (Мобильное приложение)
                         ↓
            ┌────────────────────────┐
            │  INSERT INTO scans     │ ← История сканов
            └────────────────────────┘
                         ↓
            ┌────────────────────────┐
            │  TRIGGER: on_scan_insert │
            └────────────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │  UPSERT INTO children_today    │ ← Текущее состояние
        │  presence_now = 1              │
        │  bus_now = <scanned_bus_id>    │
        └────────────────────────────────┘
                         ↓
    ┌────────────────────────────────────────┐
    │  TRIGGER: on_children_today_change     │
    └────────────────────────────────────────┘
                         ↓
            ┌────────────────────────┐
            │  UPDATE groups_today   │ ← Счетчики групп
            │  children_now += 1     │
            └────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              ПРОСМОТР ДАННЫХ (AdminBusView)             │
└─────────────────────────────────────────────────────────┘
                         ↓
            AdminBusView.vue загружается
                         ↓
        ┌────────────────────────────────┐
        │  loadBusData() вызывается      │
        └────────────────────────────────┘
                         ↓
    ┌───────────────────────────────────────┐
    │  useBusData.fetchBusData(today)       │
    └───────────────────────────────────────┘
                         ↓
        ┌─────────────────────────────┐
        │  SELECT FROM children_today │ ← Дети по автобусам
        │  WHERE bus_now IS NOT NULL  │
        │    AND presence_now > 0     │
        └─────────────────────────────┘
                         ↓
        ┌─────────────────────────────┐
        │  SELECT FROM user_group_day │ ← Воспитатели
        │  WHERE day = today          │
        │    AND isPresentToday = 1   │
        │    AND bus_id IS NOT NULL   │
        └─────────────────────────────┘
                         ↓
        ┌─────────────────────────────┐
        │  Группировка по bus_id      │
        │  Подсчет количества         │
        └─────────────────────────────┘
                         ↓
            busesData.value = {
                1: { kinder_count: 15, betreuer_count: 2, betreuer_names: [...] },
                2: { kinder_count: 18, betreuer_count: 3, betreuer_names: [...] },
                3: { kinder_count: 12, betreuer_count: 2, betreuer_names: [...] }
            }
                         ↓
                Отображение в UI
```

---

### 5. Операции сброса данных (Reset)

#### 5.1 Типы reset операций

**1. "Tag starten" (event_type = 1) - Открытие дня**

Назначение: Подготовка к новому учету детей (например, перед возвращением с мероприятия)

Что происходит:
```sql
-- При ПЕРВОМ reset дня:
UPDATE groups_today
SET children_today = children_now,    -- Сохранить текущие данные
    children_now = 0;                 -- Обнулить счетчик

-- При ПОСЛЕДУЮЩИХ reset:
UPDATE groups_today
SET children_now = 0;                 -- Только обнулить счетчик

-- В ОБОИХ случаях:
UPDATE children_today
SET presence_now = 0;                 -- Все дети "не присутствуют"
```

Пример использования:
- 08:00 - Регистрация детей утром (presence_now = 1)
- 12:00 - "Tag starten" перед обедом (presence_now = 0)
- 14:00 - Повторная регистрация после обеда (presence_now = 1)

**2. "Soft Reset" (event_type = 2) - Мягкий сброс**

Назначение: Быстрое обнуление текущих данных без сохранения истории

Что происходит:
```sql
UPDATE children_today SET presence_now = 0;
UPDATE groups_today SET children_now = 0;
```

**3. "Tag schließen" (event_type = 0) - Полное закрытие дня**

Назначение: Завершение рабочего дня, полное удаление всех данных

Что происходит:
```sql
DELETE FROM children_today;
DELETE FROM groups_today;
```

#### 5.2 Логика в AdminBusView.vue

**Кнопка "Tag starten" (AdminBusView.vue:72-80)**
```javascript
async function startDay() {
    if (!confirm('Möchten Sie wirklich einen neuen Tag starten?')) {
        return
    }

    startingDay.value = true
    try {
        const today = getCurrentDateString()
        await startNewDay(today)  // Создает reset_event с type=1

        success.value = 'Tag erfolgreich gestartet!'
        dayStarted.value = true

        await loadBusData()  // Перезагрузка данных
    } catch (err) {
        error.value = 'Fehler beim Starten des Tages'
    } finally {
        startingDay.value = false
    }
}
```

**Кнопка "Soft Reset" (AdminBusView.vue:84-92)**
```javascript
async function performSoftReset() {
    if (!confirm('Soft Reset durchführen?')) {
        return
    }

    resetting.value = true
    try {
        const today = getCurrentDateString()
        await softReset(today)  // Создает reset_event с type=2

        success.value = 'Soft Reset erfolgreich durchgeführt!'
        await loadBusData()
    } catch (err) {
        error.value = 'Fehler beim Soft Reset'
    } finally {
        resetting.value = false
    }
}
```

---

### 6. Realtime обновление данных (НОВОЕ)

#### 6.1 Система автоматического обновления

**WebSocket подписка (AdminBusView.vue:484-538)**

Компонент подписывается на изменения в базе данных через Supabase Realtime:

```javascript
function setupRealtimeSubscription() {
    realtimeChannel = supabase
        .channel('bus-data-changes')

        // Подписка на изменения в children_today
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'children_today'
        }, (payload) => {
            console.log('🔄 Children data changed:', payload)
            debouncedReload()  // Отложенная перезагрузка (1 сек)
        })

        // Подписка на изменения в user_group_day
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_group_day',
            filter: `day=eq.${currentDate.value}`
        }, (payload) => {
            console.log('🔄 Betreuer data changed:', payload)
            debouncedReload()
        })

        // Подписка на reset события
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'reset_events',
            filter: `day=eq.${currentDate.value}`
        }, (payload) => {
            console.log('🔄 Reset event detected:', payload)
            debouncedReload()
        })

        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                realtimeStatus.value = 'connected'
                console.log('✅ Realtime connection established')
            }
        })
}
```

**Debounced перезагрузка (AdminBusView.vue:470-479)**
```javascript
function debouncedReload() {
    if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer)
    }

    reloadDebounceTimer = setTimeout(() => {
        console.log('🔄 Reloading bus data after changes...')
        loadBusData()
    }, 1000)  // Ждем 1 секунду после последнего изменения
}
```

#### 6.2 Индикатор соединения

В UI отображается статус realtime соединения:

```html
<div class="realtime-status">
    <span class="status-dot" :class="{
        'status-connected': realtimeStatus === 'connected',
        'status-connecting': realtimeStatus === 'connecting',
        'status-disconnected': realtimeStatus === 'disconnected'
    }"></span>
    <span class="status-text">
        {{ realtimeStatus === 'connected' ? 'Live' :
           realtimeStatus === 'connecting' ? 'Verbinde...' :
           'Offline' }}
    </span>
</div>
```

---

## 🔧 Предложения по доработке AdminBusView.vue

### Задача 1: Добавить детализированную статистику

**Что добавить:**
Раздел с подробной статистикой по каждому автобусу

**Где:** После блока "Total Summary Card"

**Структура:**
```html
<div class="bus-statistics card mb-4">
    <div class="card-body">
        <h5>Статистика по автобусам</h5>
        <div class="row">
            <div v-for="bus in totalBusRange" :key="bus" class="col-md-4 mb-3">
                <div class="stat-card" :class="{ 'has-data': getBusData(bus).hasData }">
                    <div class="stat-header">
                        <i class="fas fa-bus"></i> Bus {{ bus }}
                    </div>
                    <div class="stat-body">
                        <div class="stat-row">
                            <span class="label">Kinder:</span>
                            <span class="value">{{ getBusData(bus).kinder_count }}</span>
                        </div>
                        <div class="stat-row">
                            <span class="label">Betreuer:</span>
                            <span class="value">{{ getBusData(bus).betreuer_count }}</span>
                        </div>
                        <div class="stat-row">
                            <span class="label">Verhältnis:</span>
                            <span class="value">{{ calculateRatio(bus) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Новая computed функция:**
```javascript
// Вычисление соотношения детей к воспитателям
function calculateRatio(busNumber) {
    const busData = getBusData(busNumber)
    if (!busData.hasData || busData.betreuer_count === 0) {
        return '-'
    }
    const ratio = Math.round(busData.kinder_count / busData.betreuer_count)
    return `1:${ratio}`
}
```

**Стили:**
```css
.stat-card {
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    padding: 15px;
    transition: all 0.3s ease;
}

.stat-card.has-data {
    border-color: #28a745;
    background: linear-gradient(135deg, #f0fff4 0%, #e6ffee 100%);
}

.stat-row {
    display: flex;
    justify-content: space-between;
    margin: 8px 0;
}

.stat-row .value {
    font-weight: bold;
    color: #007bff;
}
```

---

### Задача 2: Добавить фильтрацию автобусов

**Что добавить:**
Возможность фильтровать отображение автобусов (показывать только активные/все)

**Где:** Над таблицей автобусов

**Компонент:**
```html
<div class="bus-filters mb-3">
    <div class="btn-group" role="group">
        <button
            type="button"
            class="btn"
            :class="filterMode === 'all' ? 'btn-primary' : 'btn-outline-primary'"
            @click="filterMode = 'all'"
        >
            <i class="fas fa-list"></i> Alle Busse ({{ totalBusCount }})
        </button>
        <button
            type="button"
            class="btn"
            :class="filterMode === 'active' ? 'btn-primary' : 'btn-outline-primary'"
            @click="filterMode = 'active'"
        >
            <i class="fas fa-check-circle"></i> Nur aktive ({{ activeBusesCount }})
        </button>
        <button
            type="button"
            class="btn"
            :class="filterMode === 'empty' ? 'btn-primary' : 'btn-outline-primary'"
            @click="filterMode = 'empty'"
        >
            <i class="fas fa-times-circle"></i> Nur leere
        </button>
    </div>
</div>
```

**Новый state:**
```javascript
const filterMode = ref('all')  // 'all' | 'active' | 'empty'
```

**Новый computed:**
```javascript
const filteredBusRange = computed(() => {
    const allBuses = totalBusRange.value

    if (filterMode.value === 'all') {
        return allBuses
    }

    if (filterMode.value === 'active') {
        return allBuses.filter(busNum => {
            const busData = getBusData(busNum)
            return busData.hasData
        })
    }

    if (filterMode.value === 'empty') {
        return allBuses.filter(busNum => {
            const busData = getBusData(busNum)
            return !busData.hasData
        })
    }

    return allBuses
})
```

**Изменить в таблице:**
```html
<tr v-for="busNumber in filteredBusRange" :key="busNumber">
    <!-- ... -->
</tr>
```

---

### Задача 3: Добавить историю изменений за день

**Что добавить:**
Панель с историей всех изменений (сканирования, reset операции)

**Где:** После ResetHistoryPanel

**Компонент:**
```html
<div class="change-history card mb-3">
    <div class="card-header" @click="toggleHistory">
        <h5>
            <i class="fas fa-history me-2"></i>
            Änderungsverlauf
            <i class="fas ms-2" :class="historyExpanded ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        </h5>
    </div>
    <div v-show="historyExpanded" class="card-body">
        <div v-if="loadingHistory" class="text-center py-3">
            <div class="spinner-border spinner-border-sm"></div>
        </div>
        <div v-else class="timeline">
            <div
                v-for="event in changeHistory"
                :key="event.id"
                class="timeline-item"
            >
                <div class="timeline-marker" :class="getEventTypeClass(event.type)">
                    <i class="fas" :class="getEventIcon(event.type)"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-time">{{ formatTime(event.created_at) }}</div>
                    <div class="timeline-text">
                        {{ formatEventDescription(event) }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Новые методы:**
```javascript
// State
const historyExpanded = ref(false)
const loadingHistory = ref(false)
const changeHistory = ref([])

// Загрузка истории изменений
async function loadChangeHistory() {
    loadingHistory.value = true
    try {
        const today = getCurrentDateString()

        // Загрузить последние 50 сканов
        const { data: scans, error: scanError } = await supabase
            .from('scans')
            .select(`
                id, created_at, bus_id,
                children!inner(name),
                users!inner(display_name)
            `)
            .eq('date', today)
            .order('created_at', { ascending: false })
            .limit(50)

        if (scanError) throw scanError

        changeHistory.value = scans.map(scan => ({
            id: scan.id,
            created_at: scan.created_at,
            type: 'scan',
            child_name: scan.children.name,
            user_name: scan.users.display_name,
            bus_id: scan.bus_id
        }))

    } catch (error) {
        console.error('Fehler beim Laden der Historie:', error)
    } finally {
        loadingHistory.value = false
    }
}

// Открыть/закрыть панель
function toggleHistory() {
    historyExpanded.value = !historyExpanded.value
    if (historyExpanded.value && changeHistory.value.length === 0) {
        loadChangeHistory()
    }
}

// Форматирование описания события
function formatEventDescription(event) {
    if (event.type === 'scan') {
        return `${event.child_name} → Bus ${event.bus_id} (von ${event.user_name})`
    }
    return event.description
}

// Стили для типов событий
function getEventTypeClass(type) {
    return {
        'scan': 'bg-success',
        'reset': 'bg-warning',
        'error': 'bg-danger'
    }[type] || 'bg-secondary'
}

// Иконки для типов событий
function getEventIcon(type) {
    return {
        'scan': 'fa-qrcode',
        'reset': 'fa-redo',
        'error': 'fa-exclamation-triangle'
    }[type] || 'fa-circle'
}
```

**Стили:**
```css
.timeline {
    position: relative;
    padding-left: 30px;
}

.timeline::before {
    content: '';
    position: absolute;
    left: 12px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #dee2e6;
}

.timeline-item {
    position: relative;
    margin-bottom: 20px;
}

.timeline-marker {
    position: absolute;
    left: -21px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
}

.timeline-content {
    background: #f8f9fa;
    padding: 10px 15px;
    border-radius: 6px;
}

.timeline-time {
    font-size: 0.875rem;
    color: #6c757d;
    margin-bottom: 5px;
}

.timeline-text {
    font-weight: 500;
}
```

---

### Задача 4: Добавить экспорт данных

**Что добавить:**
Возможность экспортировать текущие данные в Excel или PDF

**Где:** Рядом с кнопкой "Aktualisieren"

**Компонент:**
```html
<div class="col-md-3">
    <div class="dropdown">
        <button
            class="btn btn-info w-100 dropdown-toggle"
            type="button"
            id="exportDropdown"
            data-bs-toggle="dropdown"
        >
            <i class="fas fa-download me-2"></i>
            Exportieren
        </button>
        <ul class="dropdown-menu" aria-labelledby="exportDropdown">
            <li>
                <a class="dropdown-item" href="#" @click.prevent="exportToExcel">
                    <i class="fas fa-file-excel me-2"></i>Excel (.xlsx)
                </a>
            </li>
            <li>
                <a class="dropdown-item" href="#" @click.prevent="exportToPDF">
                    <i class="fas fa-file-pdf me-2"></i>PDF
                </a>
            </li>
            <li>
                <a class="dropdown-item" href="#" @click.prevent="exportToCSV">
                    <i class="fas fa-file-csv me-2"></i>CSV
                </a>
            </li>
        </ul>
    </div>
</div>
```

**Методы экспорта:**

```javascript
// Установить зависимости:
// npm install xlsx jspdf jspdf-autotable

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Экспорт в Excel
function exportToExcel() {
    const data = []

    // Заголовок
    data.push(['Bus-Übersicht - ' + formattedCurrentDate.value])
    data.push([])  // Пустая строка
    data.push(['Bus', 'Kinder', 'Betreuer', 'Verantwortliche'])

    // Данные по автобусам
    totalBusRange.value.forEach(busNum => {
        const busData = getBusData(busNum)
        data.push([
            `Bus ${busNum}`,
            busData.kinder_count,
            busData.betreuer_count,
            busData.betreuer_names.join(', ')
        ])
    })

    // Итого
    data.push([])
    data.push(['GESAMT', totalChildren.value, totalBetreuer.value, ''])

    // Создать Excel файл
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Busse')

    // Скачать
    const fileName = `bus-uebersicht-${currentDate.value}.xlsx`
    XLSX.writeFile(wb, fileName)

    success.value = `Daten erfolgreich nach Excel exportiert: ${fileName}`
    setTimeout(() => { success.value = null }, 3000)
}

// Экспорт в PDF
function exportToPDF() {
    const doc = new jsPDF()

    // Заголовок
    doc.setFontSize(18)
    doc.text('Bus-Übersicht', 14, 20)

    doc.setFontSize(12)
    doc.text(formattedCurrentDate.value, 14, 30)

    // Общая статистика
    doc.setFontSize(14)
    doc.text('Gesamtübersicht', 14, 45)
    doc.setFontSize(11)
    doc.text(`Gesamt Kinder: ${totalChildren.value}`, 14, 53)
    doc.text(`Gesamt Betreuer: ${totalBetreuer.value}`, 14, 60)
    doc.text(`Aktive Busse: ${activeBusesCount.value} von ${totalBusCount.value}`, 14, 67)

    // Таблица автобусов
    const tableData = totalBusRange.value.map(busNum => {
        const busData = getBusData(busNum)
        return [
            `Bus ${busNum}`,
            busData.kinder_count,
            busData.betreuer_count,
            busData.betreuer_names.join(', ') || '-'
        ]
    })

    doc.autoTable({
        head: [['Bus', 'Kinder', 'Betreuer', 'Verantwortliche']],
        body: tableData,
        startY: 75,
        theme: 'grid',
        headStyles: {
            fillColor: [102, 126, 234],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        }
    })

    // Скачать
    const fileName = `bus-uebersicht-${currentDate.value}.pdf`
    doc.save(fileName)

    success.value = `Daten erfolgreich als PDF exportiert: ${fileName}`
    setTimeout(() => { success.value = null }, 3000)
}

// Экспорт в CSV
function exportToCSV() {
    let csv = 'Bus;Kinder;Betreuer;Verantwortliche\n'

    totalBusRange.value.forEach(busNum => {
        const busData = getBusData(busNum)
        csv += `Bus ${busNum};${busData.kinder_count};${busData.betreuer_count};"${busData.betreuer_names.join(', ')}"\n`
    })

    csv += `\nGESAMT;${totalChildren.value};${totalBetreuer.value};\n`

    // Создать Blob и скачать
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `bus-uebersicht-${currentDate.value}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    success.value = 'Daten erfolgreich als CSV exportiert'
    setTimeout(() => { success.value = null }, 3000)
}
```

---

### Задача 5: Добавить поиск по детям

**Что добавить:**
Возможность быстро найти, в каком автобусе находится конкретный ребенок

**Где:** Над таблицей автобусов

**Компонент:**
```html
<div class="child-search card mb-3">
    <div class="card-body">
        <div class="row align-items-end">
            <div class="col-md-9">
                <label class="form-label">
                    <i class="fas fa-search me-2"></i>
                    Kind suchen
                </label>
                <input
                    type="text"
                    class="form-control"
                    v-model="searchQuery"
                    placeholder="Name des Kindes eingeben..."
                    @input="searchChild"
                >
            </div>
            <div class="col-md-3">
                <button
                    class="btn btn-outline-secondary w-100"
                    @click="clearSearch"
                    :disabled="!searchQuery"
                >
                    <i class="fas fa-times me-2"></i>
                    Löschen
                </button>
            </div>
        </div>

        <!-- Результаты поиска -->
        <div v-if="searchResults.length > 0" class="search-results mt-3">
            <h6 class="border-bottom pb-2">Suchergebnisse ({{ searchResults.length }})</h6>
            <div class="list-group">
                <div
                    v-for="result in searchResults"
                    :key="result.child_id"
                    class="list-group-item list-group-item-action"
                    @click="highlightBus(result.bus_now)"
                >
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>{{ result.child_name }}</strong>
                            <span class="text-muted ms-2">({{ result.age }} Jahre)</span>
                        </div>
                        <div>
                            <span class="badge bg-primary">
                                <i class="fas fa-bus me-1"></i>
                                Bus {{ result.bus_now }}
                            </span>
                            <span class="badge bg-info ms-2">
                                Gruppe {{ result.group_id }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Нет результатов -->
        <div v-else-if="searchQuery && !searchLoading" class="alert alert-info mt-3 mb-0">
            <i class="fas fa-info-circle me-2"></i>
            Keine Kinder gefunden für "{{ searchQuery }}"
        </div>
    </div>
</div>
```

**Новые методы:**
```javascript
// State
const searchQuery = ref('')
const searchResults = ref([])
const searchLoading = ref(false)
const highlightedBus = ref(null)

// Поиск ребенка
async function searchChild() {
    if (searchQuery.value.length < 2) {
        searchResults.value = []
        return
    }

    searchLoading.value = true
    try {
        const { data, error } = await supabase
            .from('children_today')
            .select(`
                child_id,
                group_id,
                bus_now,
                children!inner(
                    id,
                    name,
                    age
                )
            `)
            .ilike('children.name', `%${searchQuery.value}%`)
            .not('bus_now', 'is', null)
            .gt('presence_now', 0)

        if (error) throw error

        searchResults.value = data.map(item => ({
            child_id: item.child_id,
            child_name: item.children.name,
            age: item.children.age,
            group_id: item.group_id,
            bus_now: item.bus_now
        }))

    } catch (error) {
        console.error('Fehler bei der Suche:', error)
        error.value = 'Fehler bei der Suche'
    } finally {
        searchLoading.value = false
    }
}

// Очистить поиск
function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    highlightedBus.value = null
}

// Подсветить автобус в таблице
function highlightBus(busNumber) {
    highlightedBus.value = busNumber

    // Прокрутить к автобусу
    const busRow = document.querySelector(`[data-bus="${busNumber}"]`)
    if (busRow) {
        busRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // Убрать подсветку через 3 секунды
    setTimeout(() => {
        highlightedBus.value = null
    }, 3000)
}
```

**Изменить в таблице:**
```html
<tr
    v-for="busNumber in totalBusRange"
    :key="busNumber"
    :data-bus="busNumber"
    :class="{
        'table-secondary': !getBusData(busNumber).hasData,
        'table-warning': highlightedBus === busNumber
    }"
>
```

**Добавить стили:**
```css
.search-results {
    max-height: 400px;
    overflow-y: auto;
}

.table-warning {
    animation: highlight 1s ease-in-out 3;
}

@keyframes highlight {
    0%, 100% { background-color: inherit; }
    50% { background-color: #fff3cd; }
}
```

---

### Задача 6: Улучшить мобильную версию

**Что изменить:**
Оптимизировать отображение для мобильных устройств

**Изменения:**

1. **Адаптивная карточная раскладка для автобусов:**
```html
<!-- Для мобильных устройств - вместо таблицы показать карточки -->
<div class="d-md-none">
    <!-- Mobile: Card View -->
    <div
        v-for="busNumber in totalBusRange"
        :key="busNumber"
        class="bus-card mb-3"
        @click="openBusDetail(busNumber)"
    >
        <div class="bus-card-header" :class="{ 'has-data': getBusData(busNumber).hasData }">
            <div class="bus-number">
                <i class="fas fa-bus me-2"></i>
                Bus {{ busNumber }}
            </div>
            <div class="status-indicator" :class="getBusData(busNumber).hasData ? 'bg-success' : 'bg-secondary'"></div>
        </div>
        <div class="bus-card-body">
            <div class="stat-row">
                <span class="label">
                    <i class="fas fa-child me-1"></i>
                    Kinder:
                </span>
                <span class="badge bg-primary">{{ getBusData(busNumber).kinder_count }}</span>
            </div>
            <div class="stat-row">
                <span class="label">
                    <i class="fas fa-user-friends me-1"></i>
                    Betreuer:
                </span>
                <span class="badge bg-success">{{ getBusData(busNumber).betreuer_count }}</span>
            </div>
            <div v-if="getBusData(busNumber).betreuer_names.length > 0" class="betreuer-names">
                <small class="text-muted">
                    {{ getBusData(busNumber).betreuer_names.join(', ') }}
                </small>
            </div>
        </div>
    </div>
</div>

<!-- Для десктопа - оставить таблицу -->
<div class="d-none d-md-block">
    <table class="table table-hover">
        <!-- Существующая таблица -->
    </table>
</div>
```

2. **Мобильные стили:**
```css
/* Mobile Card Styles */
.bus-card {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: all 0.2s ease;
}

.bus-card:active {
    transform: scale(0.98);
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.bus-card-header {
    padding: 12px 15px;
    background: #f8f9fa;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bus-card-header.has-data {
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
}

.bus-card-body {
    padding: 15px;
}

.bus-card .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.betreuer-names {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #dee2e6;
}

/* Touch-friendly button sizes */
@media (max-width: 768px) {
    .btn {
        min-height: 44px;  /* iOS minimum touch target */
    }

    .total-summary .card-body {
        padding: 1rem;
    }

    .total-count {
        font-size: 2.5rem;
    }
}
```

---

### Задача 7: Добавить уведомления о проблемах

**Что добавить:**
Система предупреждений о потенциальных проблемах

**Где:** После Total Summary Card

**Компонент:**
```html
<div v-if="warnings.length > 0" class="warnings-panel card mb-4 border-warning">
    <div class="card-header bg-warning text-dark">
        <h5 class="mb-0">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Warnungen ({{ warnings.length }})
        </h5>
    </div>
    <div class="card-body">
        <div
            v-for="(warning, index) in warnings"
            :key="index"
            class="alert alert-warning d-flex align-items-center mb-2"
            role="alert"
        >
            <i class="fas fa-exclamation-circle me-3"></i>
            <div class="flex-grow-1">
                <strong>{{ warning.title }}</strong>
                <p class="mb-0">{{ warning.message }}</p>
            </div>
            <button
                v-if="warning.action"
                class="btn btn-sm btn-warning ms-3"
                @click="warning.action.handler"
            >
                {{ warning.action.label }}
            </button>
        </div>
    </div>
</div>
```

**Логика проверки:**
```javascript
// Computed для проверки предупреждений
const warnings = computed(() => {
    const result = []

    // 1. Проверка: слишком много детей на одного воспитателя
    totalBusRange.value.forEach(busNum => {
        const busData = getBusData(busNum)
        if (busData.hasData && busData.betreuer_count > 0) {
            const ratio = busData.kinder_count / busData.betreuer_count
            if (ratio > 10) {  // Порог: более 10 детей на воспитателя
                result.push({
                    title: `Bus ${busNum}: Zu viele Kinder pro Betreuer`,
                    message: `Verhältnis: 1:${Math.round(ratio)} (${busData.kinder_count} Kinder, ${busData.betreuer_count} Betreuer)`,
                    severity: 'high',
                    action: {
                        label: 'Details anzeigen',
                        handler: () => openBusDetail(busNum)
                    }
                })
            }
        }
    })

    // 2. Проверка: автобус без воспитателей
    totalBusRange.value.forEach(busNum => {
        const busData = getBusData(busNum)
        if (busData.kinder_count > 0 && busData.betreuer_count === 0) {
            result.push({
                title: `Bus ${busNum}: Kein Betreuer`,
                message: `${busData.kinder_count} Kinder warten auf Betreuer`,
                severity: 'critical',
                action: {
                    label: 'Betreuer zuweisen',
                    handler: () => assignBetreuerToBus(busNum)
                }
            })
        }
    })

    // 3. Проверка: не все автобусы заполнены
    if (activeBusesCount.value < totalBusCount.value && totalChildren.value > 0) {
        const emptyBuses = totalBusCount.value - activeBusesCount.value
        result.push({
            title: 'Nicht alle Busse belegt',
            message: `${emptyBuses} von ${totalBusCount.value} Bussen sind leer. Möchten Sie die Verteilung optimieren?`,
            severity: 'low',
            action: {
                label: 'Optimieren',
                handler: () => optimizeBusDistribution()
            }
        })
    }

    // 4. Проверка: день еще не начат
    if (!dayStarted.value && totalChildren.value > 0) {
        result.push({
            title: 'Tag noch nicht gestartet',
            message: 'Es gibt bereits registrierte Kinder, aber der Tag wurde noch nicht offiziell gestartet.',
            severity: 'medium',
            action: {
                label: 'Tag starten',
                handler: startDay
            }
        })
    }

    return result
})

// Метод оптимизации распределения (заглушка)
function optimizeBusDistribution() {
    // TODO: Реализовать алгоритм перераспределения
    alert('Funktion wird entwickelt')
}

// Метод назначения воспитателя (заглушка)
function assignBetreuerToBus(busNumber) {
    // TODO: Открыть модальное окно для выбора воспитателя
    alert(`Betreuer für Bus ${busNumber} zuweisen`)
}
```

---

**Конец технического задания**
