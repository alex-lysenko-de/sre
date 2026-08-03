# Обзор composables

Composables в `src/composables/` — фактический API-слой приложения (см.
[[Целевая-архитектура]], [[Обзор-архитектуры]]): вся работа с Supabase
изолирована здесь, а не разбросана по компонентам (правило из `readme.md`).

## Общий паттерн

Каждый файл экспортирует функцию `useXXX()`, возвращающую объект методов
(а не реактивное состояние — состояние живёт в компонентах или в Pinia
store'ах). Внутри — прямые вызовы `supabase.from(...)`, обёрнутые в
`try/catch` с `console.error(...)` и повторным выбросом `Error` с
человекочитаемым (немецким) сообщением. Единственные исключения из этого
паттерна — [[useGroups]] (экспортирует именованные функции напрямую, без
обёртки `useGroups()`) и [[useSupabaseUser]]/[[useUser]] (описаны отдельно
в разделе 04, так как относятся к модели пользователя/аутентификации).

## Таблица: composable → таблицы БД → потребители

| Composable | Таблицы | Основные потребители (views) |
|---|---|---|
| [[useArmband]] | [[children]] | `ArmbandView.vue`, `ArmbandConnectView.vue` |
| [[useScan]] | [[scans]] | Экраны истории сканов |
| `useScanPacket.js` (тикет 120) | `scan_packets`, [[scans]] | `ScannerBusView.vue`/`ScannerGroupView.vue`/`ScannerCheckinView.vue` |
| `useCheckpoints.js` (тикет 133) | [[checkpoints]], `scan_packets`, [[children]] | `CheckpointListView.vue`/`CheckpointBusView.vue`/`CheckpointGroupView.vue`/`CheckpointLazyView.vue` |
| `useSupabaseCheckpoints.js` (тикет 133) | [[checkpoints]], `scan_packets`, [[scans]] | только через `useCheckpoints.js` (чистый DB-слой, без бизнес-логики) |
| `useLazyCheckpointProgress.js` (тикет 133) | [[children]], `scan_packets` | `CheckpointLazyView.vue` |
| `useBetreuerEntity.js` (тикет 133) | [[users]] | Entity-карточки воспитателя |
| [[useDays]] | [[days]] | `DaysEditView.vue` (reset-операции удалены тикетом 137) |
| [[useChildren]] | [[children]], [[scans]] | `GroupEditView.vue`, `ChildEditView.vue`, `ChildCardView.vue`, `SelectChildView.vue`, `AddEditChildModal.vue`, `useCheckpoints.js` |
| [[useUser]] / [[useSupabaseUser]] | [[users]], [[user_group_day]] | см. раздел 04 |

`useBusData.js`/`useGroups.js`/`useChildPresence.js` — **удалены тикетом
137** (см. соответствующие заметки, помечены историческими); заменены
строками выше ([[Checkpoint]]).

## Связанные заметки

- [[Обзор-архитектуры]]
- [[Обзор-схемы-БД]]
- [[Структура-каталогов]]
