# `useDays.js`

> Источник: `src/composables/useDays.js`.

Две разные ответственности в одном composable: CRUD расписания дней
([[days]]) и reset-операции над оперативными данными ([[reset_events]]).

## CRUD дней (`DaysEditView.vue`)

- `fetchDaysList()` — список [[days]], сортировка по дате.
- `deleteDay(dayId)` — `DELETE ... RETURNING`, явно проверяет
  `data.length === 0` и бросает описательную ошибку про RLS — компенсация
  того, что PostgREST не считает «0 строк удалено RLS-политикой» ошибкой
  (см. [[days]], тикет 102).
- `saveDay(dayData)` — insert/update в зависимости от наличия `id`; при
  ошибке RLS распознаёт `violates row-level security policy` в тексте
  ошибки Supabase и подменяет её более понятным сообщением; после `UPDATE`
  так же проверяет, что реально что-то обновилось.

## Reset-операции (`AdminBusView.vue`, см. [[Учёт-автобусов]])

- `isDayStarted(date)` / `isDayClosed(date)` — читают последний
  относящийся [[reset_events]] для даты, чтобы определить текущее
  состояние дня (открыт/закрыт), не храня отдельного явного поля статуса
  дня.
- `startNewDay(date)` — `INSERT reset_events` с `event_type = 1`.
- `softReset(date)` — `event_type = 2`.
- `closeDay(date)` — `event_type = 0`.

Во всех трёх — `user_id` берётся через `getCurrentUser()` (ре-экспорт
[[useSupabaseUser]]) перед вставкой.

## Почему RLS-ошибки перехватываются и переформулируются здесь

Оба паттерна (`deleteDay`, `saveDay`) защищаются от одного и того же
класса проблем: Supabase/PostgREST не всегда возвращает явную ошибку,
когда RLS молча блокирует операцию (0 затронутых строк вместо ошибки
доступа) — composable добавляет клиентскую проверку количества
затронутых строк поверх серверного RLS, чтобы UI показывал осмысленное
сообщение, а не ложный «успех».

## Связанные заметки

- [[days]]
- [[reset_events]]
- [[useSupabaseUser]]
- [[Триггеры]]
- [[RLS-политики]]
- [[Учёт-автобусов]]
