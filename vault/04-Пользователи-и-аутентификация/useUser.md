# `useUser.js` (composable)

> Источник: `src/composables/useUser.js`.

Слой бизнес-логики поверх [[useSupabaseUser]] — кэширование, оркестрация,
без прямых обращений к Supabase.

## Кэш пользователя

- Ключ `user_info_cache`, TTL = 60 секунд (`CACHE_TTL = 60 * 1000`).
- Хранится через `getAuthItem`/`setAuthItem`/`removeAuthItem` из
  `src/modules/storage.js` (LocalForage, не `localStorage`) — см.
  [[Кэширование-LocalForage]].
- `loadFromCache()` / `saveToCache()` / `clearCache()`.

## `fetchUserFromSupabase()`

Собирает единый объект `userInfo` из нескольких источников:

1. `getSession()` → `authUserId`
2. `fetchUserFromDB(authUserId)` → базовые поля из [[users]]
3. `fetchScheduleForDate(userData.id, today)` → расписание на сегодня из
   [[user_group_day]]
4. Если расписания на сегодня нет — fallback на
   `fetchLastKnownSchedule()` (последняя известная запись) для
   предзаполнения `group_id`/`bus_id` в форме check-in (см.
   [[Группы-и-рабочий-день]]).

Результат: `{ ...userData, group_id, bus_id, bMustWorkToday, isPresentToday,
description }`.

## `upsertScheduleField(userId, date, updates)`

Точечное обновление одного или нескольких полей [[user_group_day]] за
конкретный день: проверяет существование записи (`checkScheduleExists`),
затем `updateScheduleRecord()` или `insertScheduleRecord()`. Используется
[[stores-user]] для `assignUserToGroup()`/`assignUserToBus()`/
`updateUserPresence()` — каждый вызов обновляет только своё поле, не
затрагивая остальные.

## Realtime (admin)

`createRealtimeSubscription()` / `removeRealtimeSubscription()` — подписка
на `postgres_changes` (`UPDATE` на [[users]]), используется только для
администраторов (см. [[stores-user]].`subscribeToUserStatus()`), например
для логирования деактивации пользователя.

## Связанные заметки

- [[useSupabaseUser]]
- [[stores-user]]
- [[Кэширование-LocalForage]]
- [[user_group_day]]
- [[Модель-аутентификации]]
