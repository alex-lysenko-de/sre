# Техническое задание: Доработка модуля ChildrenView.vue

## 📋 Описание проблемы

### Текущее состояние

**Файл:** `src/views/ChildrenView.vue`

**Проблема:** Компонент отображает **синтетические (фейковые) данные** вместо реальных данных из базы данных.

#### Что генерируется сейчас (строки 123-139):

```javascript
const initGroups = (count) => {
    const betreuerNames = ['Anna', 'Max', 'Lisa', 'Paul', 'Sophie', 'Jonas']
    groups.value = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        morning: 10,                                          // ❌ Фиксированное значение
        current: Math.floor(8 + Math.random() * 3),          // ❌ Случайное число 8-10
        betreuer: [                                          // ❌ Случайные имена
            betreuerNames[Math.floor(Math.random() * betreuerNames.length)],
            betreuerNames[Math.floor(Math.random() * betreuerNames.length)],
        ],
        timestamp: new Date().toLocaleTimeString('de-DE', {  // ❌ Текущее время
            hour: '2-digit',
            minute: '2-digit',
        }),
    }))
}
```

### Требуемое состояние

Компонент должен загружать **реальные данные** из следующих таблиц:

1. **`groups_today`** - счетчики детей по группам
2. **`user_group_day`** - расписание воспитателей (Betreuer)
3. **`users`** - имена воспитателей

---

## 🗄️ Структура данных в базе

### Таблица: `groups_today`

```sql
CREATE TABLE groups_today (
    id             bigint PRIMARY KEY,
    user_id        bigint NOT NULL UNIQUE,     -- FK → users
    group_id       smallint NOT NULL UNIQUE,   -- Номер группы (1, 2, 3, ...)
    children_today smallint DEFAULT 0,         -- Детей утром (morning)
    children_now   smallint DEFAULT 0          -- Детей сейчас (current)
);
```

**Пример данных:**
| id | user_id | group_id | children_today | children_now |
|----|---------|----------|----------------|--------------|
| 1  | 5       | 1        | 12             | 10           |
| 2  | 7       | 2        | 15             | 15           |
| 3  | 9       | 3        | 10             | 8            |

### Таблица: `user_group_day`

```sql
CREATE TABLE user_group_day (
    id              bigint PRIMARY KEY,
    created_at      timestamp DEFAULT now(),
    day             date,                       -- Дата мероприятия (YYYY-MM-DD)
    user_id         bigint,                     -- FK → users.id
    group_id        smallint,                   -- Номер группы
    bus_id          smallint,                   -- Номер автобуса
    bMustWorkToday  smallint DEFAULT 0,         -- Должен работать
    isPresentToday  smallint DEFAULT 0,         -- Присутствует физически
    description     varchar
);
```

**Пример данных:**
| id | day        | user_id | group_id | bus_id | isPresentToday |
|----|------------|---------|----------|--------|----------------|
| 1  | 2025-12-26 | 5       | 1        | 1      | 1              |
| 2  | 2025-12-26 | 7       | 2        | 1      | 1              |
| 3  | 2025-12-26 | 8       | 2        | 1      | 0              |
| 4  | 2025-12-26 | 9       | 3        | 2      | 1              |

### Таблица: `users`

```sql
CREATE TABLE users (
    id           bigint PRIMARY KEY,
    user_id      uuid,                  -- FK → auth.users
    email        text,
    display_name text,                  -- Отображаемое имя
    role         text,                  -- 'admin' | 'user'
    active       boolean DEFAULT true
);
```

**Пример данных:**
| id | email          | display_name | role  |
|----|----------------|--------------|-------|
| 5  | max@mail.de    | Max Müller   | user  |
| 7  | anna@mail.de   | Anna Schmidt | user  |
| 8  | lisa@mail.de   | Lisa Weber   | user  |
| 9  | paul@mail.de   | Paul Klein   | user  |

---

## 🎯 Задачи для реализации

### ✅ Задача 1: Создать композабл `useGroups.js`

**Файл:** `src/composables/useGroups.js`

**Назначение:** Централизованная логика для работы с данными групп

#### 1.1 Функция: `fetchGroupsData(date)`

Загружает данные по всем группам на указанную дату.

**Алгоритм:**

```javascript
/**
 * Fetches groups data for a specific date
 * Combines data from groups_today and user_group_day
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of group objects
 */
async function fetchGroupsData(date) {
    try {
        // 1. Загрузить счетчики детей из groups_today
        const { data: groupsData, error: groupsError } = await supabase
            .from('groups_today')
            .select('group_id, children_today, children_now')
            .order('group_id', { ascending: true })

        if (groupsError) throw groupsError

        // 2. Загрузить воспитателей из user_group_day с именами
        const { data: betreuerData, error: betreuerError } = await supabase
            .from('user_group_day')
            .select(`
                group_id,
                user_id,
                users!inner(
                    id,
                    display_name
                )
            `)
            .eq('day', date)
            .eq('isPresentToday', 1)  // Только подтвердившие присутствие
            .order('group_id', { ascending: true })

        if (betreuerError) throw betreuerError

        // 3. Сгруппировать воспитателей по группам
        const betreuerByGroup = {}
        if (betreuerData) {
            betreuerData.forEach(item => {
                const groupId = item.group_id
                if (!betreuerByGroup[groupId]) {
                    betreuerByGroup[groupId] = []
                }
                betreuerByGroup[groupId].push(item.users.display_name)
            })
        }

        // 4. Объединить данные
        const result = []

        // Получить общее количество групп из config
        const configStore = useConfigStore()
        const totalGroups = configStore.totalGroups || 15

        // Создать записи для всех групп
        for (let groupId = 1; groupId <= totalGroups; groupId++) {
            // Найти счетчики для этой группы
            const groupData = groupsData?.find(g => g.group_id === groupId)

            result.push({
                id: groupId,
                morning: groupData?.children_today || 0,
                current: groupData?.children_now || 0,
                betreuer: betreuerByGroup[groupId] || [],
                timestamp: null,  // Пока не используем
                hasData: !!groupData  // Есть ли данные для этой группы
            })
        }

        return result

    } catch (error) {
        console.error('Fehler beim Laden der Gruppendaten:', error)
        throw error
    }
}
```

#### 1.2 Функция: `fetchGroupDetails(groupId)`

Загружает детальную информацию о конкретной группе с списком детей.

```javascript
/**
 * Fetches detailed information about a specific group
 * Including list of children currently in this group
 *
 * @param {number} groupId - Group number
 * @returns {Promise<Object>} Group details with children list
 */
async function fetchGroupDetails(groupId) {
    try {
        // 1. Загрузить счетчики группы
        const { data: groupData, error: groupError } = await supabase
            .from('groups_today')
            .select('*')
            .eq('group_id', groupId)
            .maybeSingle()

        if (groupError) throw groupError

        // 2. Загрузить список детей в группе
        const { data: childrenData, error: childrenError } = await supabase
            .from('children_today')
            .select(`
                child_id,
                presence_now,
                presence_today,
                bus_now,
                children!inner(
                    id,
                    name,
                    age,
                    schwimmer
                )
            `)
            .eq('group_id', groupId)
            .gt('presence_today', 0)  // Только те, кто был сегодня
            .order('children(name)', { ascending: true })

        if (childrenError) throw childrenError

        // 3. Загрузить воспитателей группы
        const today = new Date().toISOString().split('T')[0]
        const { data: betreuerData, error: betreuerError } = await supabase
            .from('user_group_day')
            .select(`
                user_id,
                bus_id,
                users!inner(
                    id,
                    display_name,
                    email
                )
            `)
            .eq('day', today)
            .eq('group_id', groupId)
            .eq('isPresentToday', 1)

        if (betreuerError) throw betreuerError

        // 4. Форматировать детей
        const children = (childrenData || []).map(item => ({
            id: item.children.id,
            name: item.children.name,
            age: item.children.age,
            schwimmer: item.children.schwimmer,
            presence_now: item.presence_now,
            presence_today: item.presence_today,
            bus_now: item.bus_now
        }))

        // 5. Форматировать воспитателей
        const betreuer = (betreuerData || []).map(item => ({
            id: item.users.id,
            name: item.users.display_name,
            email: item.users.email,
            bus_id: item.bus_id
        }))

        return {
            group_id: groupId,
            children_today: groupData?.children_today || 0,
            children_now: groupData?.children_now || 0,
            children: children,
            betreuer: betreuer
        }

    } catch (error) {
        console.error('Fehler beim Laden der Gruppendetails:', error)
        throw error
    }
}
```

#### 1.3 Функция: `getGroupSummary(date)`

Возвращает сводную статистику по всем группам.

```javascript
/**
 * Gets summary statistics for all groups
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Summary statistics
 */
async function getGroupSummary(date) {
    try {
        const groups = await fetchGroupsData(date)

        return {
            total_groups: groups.length,
            active_groups: groups.filter(g => g.hasData).length,
            total_morning: groups.reduce((sum, g) => sum + g.morning, 0),
            total_current: groups.reduce((sum, g) => sum + g.current, 0),
            missing_children: groups.reduce((sum, g) => {
                const diff = g.morning - g.current
                return sum + (diff > 0 ? diff : 0)
            }, 0),
            groups_with_missing: groups.filter(g => g.morning > g.current).length
        }

    } catch (error) {
        console.error('Fehler beim Berechnen der Zusammenfassung:', error)
        throw error
    }
}
```

#### 1.4 Полный экспорт композабла

```javascript
// src/composables/useGroups.js
import { supabase } from '@/supabase'  // ← ВАЖНО: использовать '@/supabase', а не '@/lib/supabaseClient'
import { useConfigStore } from '@/stores/config'

export function useGroups() {
    return {
        fetchGroupsData,
        fetchGroupDetails,
        getGroupSummary
    }
}
```

---

### ✅ Задача 2: Доработать ChildrenView.vue

**Файл:** `src/views/ChildrenView.vue`

#### 2.1 Изменить импорты

**Было:**
```javascript
import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '@/stores/config'
```

**Стало:**
```javascript
import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useGroups } from '@/composables/useGroups'  // ← Добавить
```

#### 2.2 Изменить setup() функцию

**Было (строки 87-145):**
```javascript
setup() {
    const configStore = useConfigStore()
    const groups = ref([])

    // ... computed properties ...

    // Generate placeholder groups
    const initGroups = (count) => {
        const betreuerNames = ['Anna', 'Max', 'Lisa', 'Paul', 'Sophie', 'Jonas']
        groups.value = Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            morning: 10,
            current: Math.floor(8 + Math.random() * 3),
            betreuer: [
                betreuerNames[Math.floor(Math.random() * betreuerNames.length)],
                betreuerNames[Math.floor(Math.random() * betreuerNames.length)],
            ],
            timestamp: new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        }))
    }

    onMounted(async () => {
        const loaded = await configStore.loadConfig()
        const total = parseInt(loaded?.total_groups || 15)
        initGroups(total)
    })

    return { groups, totalMorning, totalCurrent, ... }
}
```

**Стало:**
```javascript
setup() {
    const configStore = useConfigStore()
    const { fetchGroupsData } = useGroups()

    // ============================================================================
    // STATE
    // ============================================================================
    const groups = ref([])
    const loading = ref(false)
    const error = ref(null)
    const lastUpdateTime = ref(null)
    const currentDate = ref(getCurrentDateString())

    // ============================================================================
    // COMPUTED PROPERTIES
    // ============================================================================
    const totalMorning = computed(() =>
        groups.value.reduce((sum, g) => sum + (g.morning || 0), 0)
    )

    const totalCurrent = computed(() =>
        groups.value.reduce((sum, g) => sum + (g.current || 0), 0)
    )

    const missingGroups = computed(() =>
        groups.value.filter((g) => g.morning > (g.current || 0))
    )

    const totalMissing = computed(() =>
        missingGroups.value.reduce((sum, g) => sum + (g.morning - (g.current || 0)), 0)
    )

    // ============================================================================
    // METHODS
    // ============================================================================

    function getCurrentDateString() {
        return new Date().toISOString().split('T')[0]
    }

    function getCurrentTimeForDisplay() {
        return new Date().toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    /**
     * Load groups data from database
     */
    async function loadGroupsData() {
        loading.value = true
        error.value = null

        try {
            const today = getCurrentDateString()
            const data = await fetchGroupsData(today)

            groups.value = data
            lastUpdateTime.value = getCurrentTimeForDisplay()

            console.log('✅ Gruppendaten geladen:', data)

        } catch (err) {
            console.error('❌ Fehler beim Laden der Gruppendaten:', err)
            error.value = 'Fehler beim Laden der Gruppendaten. Bitte versuchen Sie es erneut.'
        } finally {
            loading.value = false
        }
    }

    /**
     * Determine status color class
     */
    const getStatusClass = (group) => {
        if (!group.hasData) return 'bg-secondary'       // Keine Daten
        if (group.current === group.morning) return 'bg-success'  // Vollständig
        if (group.current < group.morning) return 'bg-warning'    // Fehlen
        return 'bg-info'  // Mehr als erwartet
    }

    /**
     * Format difference between morning and current
     */
    const formatDifference = (group) => {
        if (!group.hasData) return '<span class="text-muted">-</span>'
        if (group.morning == null || group.current == null) return '-'

        const diff = group.morning - group.current

        if (diff === 0)
            return '<span class="text-success">✓ Komplett</span>'
        if (diff > 0)
            return `<span class="text-danger">-${diff}</span>`
        return `<span class="text-info">+${Math.abs(diff)}</span>`
    }

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    onMounted(async () => {
        // Load config
        if (!configStore.isConfigLoaded()) {
            await configStore.loadConfig()
        }

        // Load groups data
        await loadGroupsData()
    })

    return {
        // State
        groups,
        loading,
        error,
        lastUpdateTime,
        currentDate,

        // Computed
        totalMorning,
        totalCurrent,
        missingGroups,
        totalMissing,

        // Methods
        getStatusClass,
        formatDifference,
        loadGroupsData
    }
}
```

#### 2.3 Добавить UI элементы

**Добавить кнопку обновления и индикаторы загрузки:**

```html
<template>
  <div class="container py-4">
    <!-- Alert для ошибок -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>
      {{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- Summary -->
    <div class="card mb-4 shadow-sm">
      <div class="card-body text-center">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="mb-0">Kinderübersicht</h4>
          <button
              class="btn btn-primary btn-sm"
              @click="loadGroupsData"
              :disabled="loading"
          >
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="fas fa-sync-alt me-2"></i>
            {{ loading ? 'Laden...' : 'Aktualisieren' }}
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading && groups.length === 0" class="py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Gruppendaten...</p>
        </div>

        <!-- Data Display -->
        <div v-else>
          <div class="row mt-3">
            <div class="col-md-6">
              <h5>Am Morgen</h5>
              <div class="display-6 text-primary">{{ totalMorning }}</div>
            </div>
            <div class="col-md-6">
              <h5>Aktuell</h5>
              <div class="display-6 text-success">{{ totalCurrent }}</div>
            </div>
          </div>

          <!-- Warning Banner -->
          <div v-if="missingGroups.length" class="alert alert-warning mt-3">
            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="me-2" />
            Achtung! {{ totalMissing }} Kind(er) fehlen in {{ missingGroups.length }} Gruppe(n)
          </div>

          <!-- Last Update Time -->
          <div class="text-muted mt-3">
            <small>
              <i class="fas fa-clock me-1"></i>
              Letzte Aktualisierung: {{ lastUpdateTime || '-' }}
            </small>
          </div>
        </div>
      </div>
    </div>

    <!-- Groups Table -->
    <div class="card shadow-sm">
      <div class="card-body">
        <h5>
          <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
          Gruppenübersicht
          <span class="badge bg-secondary ms-2">{{ groups.length }} Gruppen</span>
        </h5>

        <!-- Loading State -->
        <div v-if="loading && groups.length === 0" class="text-center py-5">
          <div class="spinner-border mb-3"></div>
          <p class="text-muted">Lade Gruppendaten...</p>
        </div>

        <!-- Table -->
        <div v-else class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead class="table-light">
            <tr>
              <th>Status</th>
              <th>Gruppe</th>
              <th>Morgen</th>
              <th>Aktuell</th>
              <th>Betreuer</th>
              <th>Differenz</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="group in groups"
                :key="group.id"
                :class="{ 'table-secondary': !group.hasData }"
            >
              <td>
                <span :class="getStatusClass(group)" class="status-dot me-1"></span>
              </td>
              <td>
                <router-link
                    :to="`/group-edit/${group.id}`"
                    class="text-decoration-none fw-bold"
                >
                  Gruppe {{ group.id }}
                </router-link>
              </td>
              <td>{{ group.morning ?? '-' }}</td>
              <td>{{ group.current ?? '-' }}</td>
              <td>
                <span v-if="group.betreuer.length > 0">
                  {{ group.betreuer.join(', ') }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td v-html="formatDifference(group)"></td>
            </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-if="!loading && groups.length === 0" class="text-center py-5">
          <i class="fas fa-info-circle fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">Keine Gruppendaten verfügbar</h5>
          <p class="text-muted">Es wurden noch keine Kinder heute registriert.</p>
        </div>
      </div>
    </div>
  </div>
</template>
```

#### 2.4 Улучшить стили

**Добавить в секцию `<style scoped>`:**

```css
.table th,
.table td {
  text-align: center;
}

.status-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
}

.status-dot.bg-success {
  background-color: #28a745 !important;
  border-color: #28a745 !important;
}

.status-dot.bg-warning {
  background-color: #ffc107 !important;
  border-color: #ffc107 !important;
}

.status-dot.bg-danger {
  background-color: #dc3545 !important;
  border-color: #dc3545 !important;
}

.status-dot.bg-info {
  background-color: #17a2b8 !important;
  border-color: #17a2b8 !important;
}

.status-dot.bg-secondary {
  background-color: #6c757d !important;
  border-color: #6c757d !important;
}

.card {
  border-radius: 1rem;
}

.alert {
  border-radius: 1rem;
}

.table-hover tbody tr:hover {
  background-color: rgba(0, 123, 255, 0.05);
}

.table tbody tr.table-secondary {
  opacity: 0.6;
}

/* Loading animation */
.spinner-border {
  width: 1rem;
  height: 1rem;
  border-width: 0.15em;
}

/* Alert animations */
.alert {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

### ✅ Задача 3: Добавить Realtime обновление

Для автоматического обновления данных при изменениях в базе данных.

#### 3.1 Добавить Realtime подписку

**В setup() функцию добавить:**

```javascript
import { supabase } from '@/supabase'
import { onUnmounted } from 'vue'

// Внутри setup():
let realtimeChannel = null
let reloadDebounceTimer = null

/**
 * Debounced reload function
 */
function debouncedReload() {
    if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer)
    }

    reloadDebounceTimer = setTimeout(() => {
        console.log('🔄 Reloading groups data after changes...')
        loadGroupsData()
    }, 1000)
}

/**
 * Setup Realtime subscription
 */
function setupRealtimeSubscription() {
    const today = getCurrentDateString()

    realtimeChannel = supabase
        .channel('groups-data-changes')

        // Subscribe to children_today changes
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'children_today'
        }, (payload) => {
            console.log('🔄 Children data changed:', payload)
            debouncedReload()
        })

        // Subscribe to groups_today changes
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'groups_today'
        }, (payload) => {
            console.log('🔄 Groups data changed:', payload)
            debouncedReload()
        })

        // Subscribe to user_group_day changes
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_group_day',
            filter: `day=eq.${today}`
        }, (payload) => {
            console.log('🔄 Betreuer data changed:', payload)
            debouncedReload()
        })

        .subscribe((status) => {
            console.log('📡 Realtime subscription status:', status)
        })
}

/**
 * Clear Realtime subscription
 */
function clearRealtimeSubscription() {
    if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer)
        reloadDebounceTimer = null
    }

    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
        realtimeChannel = null
        console.log('🔌 Realtime subscription removed')
    }
}

// В onMounted добавить:
onMounted(async () => {
    // ... existing code ...

    // Setup Realtime subscription
    setupRealtimeSubscription()
})

// Добавить onUnmounted:
onUnmounted(() => {
    clearRealtimeSubscription()
})

// В return добавить:
return {
    // ... existing returns ...
    setupRealtimeSubscription,
    clearRealtimeSubscription
}
```

---

## 📊 Сравнение: До и После

### До (Синтетические данные)

```javascript
// Фиксированные значения
{
    id: 1,
    morning: 10,                    // ❌ Всегда 10
    current: 9,                     // ❌ Случайное 8-10
    betreuer: ['Anna', 'Max'],      // ❌ Случайные имена
    timestamp: '14:30'              // ❌ Текущее время
}
```

**Проблемы:**
- ❌ Не отражает реальное состояние
- ❌ Нет связи с базой данных
- ❌ Невозможно отследить изменения
- ❌ Нет информации о реальных воспитателях

### После (Реальные данные)

```javascript
// Данные из базы данных
{
    id: 1,
    morning: 12,                         // ✅ Из groups_today.children_today
    current: 10,                         // ✅ Из groups_today.children_now
    betreuer: ['Max Müller', 'Anna Schmidt'],  // ✅ Из user_group_day + users
    hasData: true,                       // ✅ Индикатор наличия данных
    timestamp: null                      // (можно добавить позже)
}
```

**Преимущества:**
- ✅ Отражает реальное состояние детей
- ✅ Связано с базой данных через Supabase
- ✅ Возможность realtime обновления
- ✅ Реальные имена воспитателей
- ✅ Корректный подсчет утренних и текущих детей

---

## 🧪 Тестовые сценарии

### Сценарий 1: Загрузка данных при открытии страницы

**Шаги:**
1. Администратор открывает страницу `/children`
2. Компонент загружается
3. Вызывается `loadGroupsData()`
4. Данные загружаются из `groups_today` и `user_group_day`
5. Таблица отображает реальные данные

**Ожидаемый результат:**
- ✅ Показывается spinner во время загрузки
- ✅ После загрузки отображаются реальные данные
- ✅ Суммарные счетчики корректны
- ✅ Если есть недостающие дети - показывается предупреждение

### Сценарий 2: Обновление данных по кнопке

**Шаги:**
1. Пользователь находится на странице `/children`
2. Воспитатель сканирует браслет ребенка (в другом окне)
3. Администратор нажимает кнопку "Aktualisieren"
4. Данные перезагружаются

**Ожидаемый результат:**
- ✅ Кнопка становится неактивной во время загрузки
- ✅ Показывается spinner
- ✅ Счетчики обновляются
- ✅ Время последнего обновления меняется

### Сценарий 3: Realtime обновление (опционально)

**Шаги:**
1. Администратор открывает страницу `/children`
2. Воспитатель сканирует браслет ребенка (в другом окне)
3. Изменяется `children_today` в базе
4. Realtime подписка получает уведомление
5. Через 1 секунду данные автоматически перезагружаются

**Ожидаемый результат:**
- ✅ Данные обновляются автоматически
- ✅ Не происходит множественных перезагрузок (debounce работает)
- ✅ Пользователь видит актуальные данные

### Сценарий 4: Обработка ошибок

**Шаги:**
1. Имитировать ошибку базы данных (отключить интернет)
2. Открыть страницу `/children`
3. Попытаться загрузить данные

**Ожидаемый результат:**
- ✅ Показывается сообщение об ошибке
- ✅ Пользователь может закрыть сообщение
- ✅ Можно повторить попытку загрузки

### Сценарий 5: Пустое состояние

**Шаги:**
1. База данных пустая (ни один ребенок не зарегистрирован)
2. Открыть страницу `/children`

**Ожидаемый результат:**
- ✅ Показывается сообщение "Keine Gruppendaten verfügbar"
- ✅ Таблица не отображается
- ✅ Суммарные счетчики показывают 0

---

## 📋 Чеклист выполнения

### Файлы для создания

- [ ] `src/composables/useGroups.js` - новый композабл для работы с группами

### Файлы для изменения

- [ ] `src/views/ChildrenView.vue` - замена синтетических данных на реальные

### Функционал для реализации

#### useGroups.js
- [ ] Функция `fetchGroupsData(date)` - загрузка всех групп
- [ ] Функция `fetchGroupDetails(groupId)` - детали конкретной группы
- [ ] Функция `getGroupSummary(date)` - сводная статистика
- [ ] Экспорт всех функций

#### ChildrenView.vue
- [ ] Импорт `useGroups` композабла
- [ ] Добавить state: `loading`, `error`, `lastUpdateTime`, `currentDate`
- [ ] Реализовать `loadGroupsData()` метод
- [ ] Изменить `getStatusClass()` для учета `hasData`
- [ ] Изменить `formatDifference()` для учета `hasData`
- [ ] Добавить UI для загрузки (spinner)
- [ ] Добавить UI для ошибок (alert)
- [ ] Добавить кнопку "Aktualisieren"
- [ ] Добавить отображение времени обновления
- [ ] Добавить empty state (если нет данных)
- [ ] Улучшить стили для статусных точек

#### Realtime обновление 
- [ ] Добавить `setupRealtimeSubscription()` метод
- [ ] Добавить `clearRealtimeSubscription()` метод
- [ ] Добавить `debouncedReload()` функцию
- [ ] Вызвать setup в `onMounted`
- [ ] Вызвать cleanup в `onUnmounted`

---

## 🔄 Потоки данных

### Текущий поток (синтетические данные)

```
ChildrenView.vue загружается
         ↓
onMounted() вызывается
         ↓
configStore.loadConfig()  ← Загружает total_groups
         ↓
initGroups(total)  ← Генерирует фейковые данные
         ↓
groups.value = [
    { id: 1, morning: 10, current: 9, betreuer: ['Anna', 'Max'] },
    { id: 2, morning: 10, current: 8, betreuer: ['Lisa', 'Paul'] },
    ...
]
         ↓
UI отображает синтетические данные ❌
```

### Новый поток (реальные данные)

```
ChildrenView.vue загружается
         ↓
onMounted() вызывается
         ↓
configStore.loadConfig()  ← Загружает total_groups
         ↓
loadGroupsData() вызывается
         ↓
useGroups.fetchGroupsData(today)
         ↓
    ┌─────────────────────────────────┐
    │   ПАРАЛЛЕЛЬНЫЕ ЗАПРОСЫ          │
    ├─────────────────────────────────┤
    │ 1. SELECT FROM groups_today     │ ← Счетчики детей
    │    ORDER BY group_id            │
    │                                 │
    │ 2. SELECT FROM user_group_day   │ ← Воспитатели
    │    JOIN users                   │
    │    WHERE day = today            │
    │      AND isPresentToday = 1     │
    └─────────────────────────────────┘
         ↓
Группировка воспитателей по group_id
         ↓
Объединение данных для всех групп (1..total_groups)
         ↓
groups.value = [
    {
        id: 1,
        morning: 12,                        // ✅ Реальные данные
        current: 10,                        // ✅ Реальные данные
        betreuer: ['Max Müller', 'Anna Schmidt'],  // ✅ Реальные имена
        hasData: true
    },
    {
        id: 2,
        morning: 0,
        current: 0,
        betreuer: [],
        hasData: false
    },
    ...
]
         ↓
UI отображает реальные данные ✅
         ↓
setupRealtimeSubscription()  ← Подписка на изменения
         ↓
    При изменениях в БД → debouncedReload() → loadGroupsData()
```

---

## 🚀 План внедрения

### Этап 1: Создание композабла 
1. Создать файл `src/composables/useGroups.js`
2. Реализовать `fetchGroupsData(date)`
3. Реализовать `fetchGroupDetails(groupId)`
4. Реализовать `getGroupSummary(date)`
5. Тестировать в DevTools/Консоли

### Этап 2: Базовая интеграция 
1. Изменить импорты в `ChildrenView.vue`
2. Добавить state переменные
3. Реализовать `loadGroupsData()`
4. Изменить `onMounted` для вызова `loadGroupsData()`
5. Протестировать загрузку данных

### Этап 3: UI улучшения 
1. Добавить кнопку "Aktualisieren"
2. Добавить spinner для loading state
3. Добавить alert для ошибок
4. Добавить отображение времени обновления
5. Добавить empty state
6. Улучшить стили статусных точек

### Этап 4: Realtime 
1. Добавить Realtime подписку
2. Реализовать debounced reload
3. Добавить cleanup в `onUnmounted`
4. Тестировать автоматическое обновление


---

## 📚 Дополнительные замечания

### Производительность

- **Кэширование**: Можно добавить кэширование в `useGroups.js` с TTL 10 секунд
- **Оптимизация запросов**: Использовать `.select()` для выбора только нужных полей

### Безопасность

- **RLS политики**: Убедиться, что RLS настроены для `groups_today` и `user_group_day`
- **Валидация**: Проверять входные параметры (date, groupId)
- **Error handling**: Не показывать технические детали ошибок пользователю



**Конец технического задания**
