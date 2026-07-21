# `useBusData.js`

> Источники: `src/composables/useBusData.js`, `doc/db/adminBusView.md`,
> `doc/AdminBusView_TechTask.md`.

Центральная логика экрана `AdminBusView.vue` (`/admin-busses`, admin-only) —
комбинирует [[children_today]] и [[user_group_day]] в единую структуру по
автобусам.

## Основные функции

- `fetchBusData(date)` — два независимых запроса (дети из `children_today`
  где `bus_now IS NOT NULL AND presence_now > 0`; Betreuer из
  `user_group_day` JOIN `users` где `day=:date AND isPresentToday=1 AND
  bus_id IS NOT NULL`), затем группировка по `bus_id` на клиенте.
  Результат: `{ busNumber: { kinder_count, betreuer_count, betreuer_names } }`.
- `fetchSingleBusData(busNumber, date)` — обёртка над `fetchBusData` для
  одного автобуса.
- `fetchBusSummary(date)` — агрегированная сводка (`total_children`,
  `total_betreuer`, `buses_with_data`).
- `fetchBusChildren(busNumber)` / `fetchBusBetreuer(busNumber, date)` —
  детальные списки для `BusDetailModal.vue`.
- `getResetHistory(date)` — список [[reset_events]] за дату (с именами
  через JOIN `users`), для `ResetHistoryPanel.vue`.
- `getCurrentUser` — ре-экспорт из [[useSupabaseUser]] для удобства
  (нужен `users.id` перед созданием [[reset_events]] в [[useDays]]).

## Reset-операции (делегированы `useDays`)

`AdminBusView.vue` вызывает `startNewDay()`/`softReset()`/`closeDay()` из
[[useDays]], а не из `useBusData` — сам `useBusData` reset-события не
создаёт, только читает их историю (`getResetHistory`). См. [[Триггеры]] для
эффекта каждой операции.

## Связанные заметки

- [[children_today]]
- [[user_group_day]]
- [[reset_events]]
- [[useDays]]
- [[useSupabaseUser]]
- [[Учёт-автобусов]]
