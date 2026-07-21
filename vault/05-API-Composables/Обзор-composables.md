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
| [[useScan]] | [[scans]] | `ScannerView.vue` и другие экраны истории сканов |
| [[useBusData]] | [[children_today]], [[user_group_day]], [[reset_events]] | `AdminBusView.vue`, `BusDetailModal.vue`, `ResetHistoryPanel.vue` |
| [[useGroups]] | [[groups_today]], [[user_group_day]], [[config]] | `ChildrenView.vue`, `GroupEditView.vue` |
| [[useDays]] | [[days]], [[reset_events]] | `DaysEditView.vue`, `AdminBusView.vue` |
| [[useChildren]] | [[children]], [[scans]] | `ChildrenView.vue`, `ChildEditView.vue`, `ChildDetailView.vue`, `GroupEditView.vue` |
| [[useChildPresence]] | [[children_today]] | `HeadcountView.vue` (тикет 106) |
| [[useUser]] / [[useSupabaseUser]] | [[users]], [[user_group_day]] | см. раздел 04 |

## Связанные заметки

- [[Обзор-архитектуры]]
- [[Обзор-схемы-БД]]
- [[Структура-каталогов]]
