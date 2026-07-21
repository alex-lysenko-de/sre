
## 🧾 **Техническое задание: модуль `useUser.js`**

> **Status (Stand: 2026-07):** Реализовано как связка трёх слоёв вместо одного модуля: `src/composables/useUser.js` (кеш/оркестрация), `src/composables/useSupabaseUser.js` (запросы к Supabase) и `src/stores/user.js` (Pinia-store, публичный API для компонентов, поля `userInfo`, `isAdmin`, `isCheckInRequired`). Кеш хранится через `LocalForage` (`src/modules/storage.js`), а не `localStorage`, TTL сейчас 1 минута. Раздел "Целевая структура данных" и таблицы ниже остаются актуальным описанием бизнес-логики.

### 🎯 Цель

1. Создать Vue-модуль (`src/modules/useUser.js`), который объединяет:

* получение базовой информации о текущем пользователе из таблицы `users`;
* получение текущего расписания и статуса присутствия пользователя из таблицы `user_group_day`;
* кэширование этих данных в `LocalStorage` (по аналогии с `useConfig`);
* простые методы для управления записями в таблице `user_group_day` (создание, обновление статуса).

2. Интегрировать модуль в текущий проект. Использовать его там где требуется его присутствие 
---

### 📚 **Описание используемых таблиц**

#### Таблица `public.users`

| Поле             | Тип         | Описание                   |
| ---------------- | ----------- | -------------------------- |
| `id`             | `bigserial` | внутренний ID пользователя |
| `user_id`        | `uuid`      | ID из `auth.users`         |
| `email`          | `text`      | почта пользователя         |
| `display_name`   | `text`      | отображаемое имя           |
| `role`           | `text`      | `'admin'` или `'user'`     |
| `active`         | `boolean`   | активен ли пользователь    |
| `last_seen_date` | `timestamp` | последняя активность       |

#### Таблица `public.user_group_day`

| Поле          | Тип        | Описание                            |
| ------------- | ---------- | ----------------------------------- |
| `id`          | `bigint`   | ключ                                |
| `day`         | `date`     | дата                                |
| `user_id`     | `bigint`   | ссылка на `users.id`                |
| `group_id`    | `smallint` | номер группы                        |
| `bus_id`      | `smallint` | номер автобуса                      |
| `status`      | `smallint` | 0 — отсутствовал, 1 — присутствовал |
| `description` | `text`     | примечание                          |
Эту таблицу может заполнять любой пользоватль с правами "admin"
Обычный пользователь видит только свое рассписание и использует данные для импорта events в свой календарь (например google calender)
Если запись на текущий день отсутствует, пользователь все равно имеет право войти в систему, при этом запись создается автоматически 
---

### 🧩 **Целевая структура данных в модуле**

```js
const userInfo = ref({
  id: null,              // users.id
  user_id: null,         // users.user_id (uuid)
  email: null,           // users.email
  display_name: null,    // users.display_name
  role: null,            // users.role
  group_id: null,        // user_group_day.group_id (на сегодня)
  bus_id: null			 // user_group_day.bus_id (на сегодня) 
  bMustWorkToday: false, // true, если есть запись в user_group_day на сегодня
  isPresentToday: false, // true, если status = 1 в user_group_day

})
```

---

### 🧠 **Основная логика**

1. **Инициализация**

   * Получить текущего пользователя через `supabase.auth.getUser()`
   * Найти запись в `public.users` по `user.user_id`
   * Найти сегодняшнюю запись в `public.user_group_day`, если есть

2. **Объединить результаты** в единый объект `userInfo`.

3. **Кэширование**

   * Кэшировать `userInfo` в `localStorage` под ключом `user_info_cache`.
   * TTL (время жизни кэша) — 10 минут.

4. **Функции для работы с расписанием (`user_group_day`):**

   * `assignUserToGroup(groupId, date = today)` — создать или обновить запись (назначить пользователя в группу на день)
   * `assignUserToBus(busId, date = today)` — создать или обновить запись (привязать пользователя к автобусу)
   * `updateUserPresence(status, date = today)` — обновить статус присутствия (0/1)
   * `getUserDayInfo(date = today)` — получить расписание пользователя на конкретный день

5. **Сброс**

   * `clearUserCache()` — очищает локальный кэш и состояние (используется при logout).

---

### ⚙️ **Публичный API модуля**

```js
export function useUser() {
  return {
    userInfo,          // ref({...})
    isAdmin,           // ref(boolean)
    loading,           // ref(boolean)
    error,             // ref(Error | null)
    loadUser,          // async (force = false)
    fetchUserFromSupabase, // async ()
    assignUserToGroup, // async (groupId, date)
    assignUserToBus, // async (busId, date)	
    updateUserPresence,// async (status, date)
    getUserDayInfo,    // async (date)
    clearUserCache,    // () => void
  }
}
```

---

### 💾 **Пример использования**

```js
import { useUser } from '@/modules/useUser'

const { userInfo, loadUser, updateUserPresence } = useUser()

onMounted(async () => {
  await loadUser()
  
  if (!userInfo.value.isPresentToday) {
	{groupId , busId} = selectGroupAndBus.showModal()
	assignUserToGroup(groupId)
    assignUserToBus(busId)	
    updateUserPresence(1) // Отметить присутствие
  }
})
```

---

### 🔐 **Требования**

* Язык интерфейса - немецкий
* Язык комментариев - английский

---

### 🧮 **Дальнейшие улучшения (в будущем)**

* Добавить интеграцию с компонентом отображения и редактирования расписания  для админов (по всем пользователям).
* Добавить интеграцию с компонентом отображения расписания для пользователя .
* разработать форму "selectGroupAndBus"
---

