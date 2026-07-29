# Реализовано (Phase 1)

Полный охват — см. `tickets/131/IMPLEMENTATION_PLAN.md`. Ниже — итог по
факту сделанного в этой сессии.

# Новые файлы

| Файл | Назначение |
|---|---|
| `doc/db/checkpoints.sql` | Таблица `checkpoints` (без CANCELLED, `status IN (1,2)`), уникальный частичный индекс "одна открытая на тип в день", колонка `scan_packets.checkpoint_id`, RLS (SELECT для `authenticated`, без прав записи). **Не применён к боевой БД.** |
| `doc/db/checkpoints_functions.sql` | `create_checkpoint`/`finish_checkpoint`/`reopen_checkpoint`/`remove_checkpoint` — все `SECURITY DEFINER`, явная проверка `role='admin' AND active=true`, `SET search_path`. `remove_checkpoint()` каскадно удаляет `scans`→`scan_packets`→`checkpoints` процедурно (три `DELETE`), не через `ON DELETE CASCADE` на живом FK. **Не применён.** |
| `doc/db/checkpoints_scan_packets_extension.sql` | Полная замена `submit_scan_packet()`: авто-создание/поиск открытой checkpoint (`ON CONFLICT (day,type) WHERE status=1 DO NOTHING` + `SELECT ... ORDER BY id DESC`), запись `checkpoint_id`. Клиентский контракт `useScanPacket.js` не меняется. **Не применён.** |
| `src/composables/useSupabaseCheckpoints.js` | DB-слой: CRUD-обёртки над `checkpoints`, `supabase.rpc()` для всех четырёх функций (первое использование RPC в проекте), Realtime-подписка. |
| `src/composables/useCheckpoints.js` | Бизнес-логика — те же экспортируемые имена/форма, что и `useCheckpointsMock.js`. Реальные запросы к `scans`/`scan_packets`/`children`/`user_group_day`. |
| `src/composables/useLazyCheckpointProgress.js` | Реальный аналог мока — "отметился"/"ещё нет" из `scans ⋈ scan_packets.checkpoint_id`. |
| `src/composables/useGroupEntity.js` | Сквозная по дню сущность "Группа" — агрегирует все GROUP-checkpoints дня для одной группы. |
| `src/components/checkpoints/*.vue` (8 файлов) | Presentational-компоненты, перенесены из `checkpoints-prototype/` без изменений (кроме composable-импортов в badges/modal); `DebugTag` не перенесён. |
| `src/views/Checkpoint{List,Bus,Group,Lazy}View.vue`, `CheckpointEntityListView.vue`, `CheckpointChildCardView.vue`, `CheckpointBetreuerCardView.vue`, `CheckpointGroupEntityView.vue` | Перенесены из `*PrototypeView.vue`, подключены к реальным composables. Async-адаптация: `getBusDelta`/`getGroupDelta`/`getBusChildrenBreakdown`/`getGroupChildrenBreakdown`/`getDayBaselineCheckpoint` стали асинхронными (реальные запросы к БД) — предвычисляются в `load()` в `ref`, а не вызываются синхронно в шаблоне/`computed()`, как в моке. |

# Изменённые файлы

| Файл | Изменение |
|---|---|
| `src/router/index.js` | 8 новых маршрутов под `/admin/checkpoints` (рядом с `/admin-busses`/`/children`, которые не тронуты). |
| `src/views/MainView.vue` | Новая кнопка "Checkpoints" (`btn-primary`, отличается цветом от жёлтой кнопки "Checkpoints (Prototyp)"), `goToCheckpoints()`. |

# Отклонения от `tickets/130/IMPLEMENTATION_PLAN.md`

- Статус CANCELLED убран из модели полностью — заменён на Reopen/Remove
  (уже провалидировано на реальном пользователе в 130_2, Раунд 1).
  `remove_checkpoint()` — физическое каскадное удаление, а не пометка
  статусом — по явному указанию пользователя в этой сессии.
- Кнопка "Bearbeiten" на карточке ребёнка ведёт на уже существующий
  `/child-edit/:id` вместо отдельного нового экрана — экономит дублирование,
  покрывает те же реальные поля.
- Карточка ребёнка не показывает родителей/телефон (выдумка мока, нет
  реального аналога в схеме `children`).
- Реальная "Gesamt"-плашка на Page 1 считается из `fetchAllChildren()`/
  `user_group_day` вместо захардкоженных чисел мока.

# Границы этой сессии (см. также IMPLEMENTATION_PLAN.md)

- **SQL не применён к боевой БД.** Файлы в `doc/db/` готовы к ревью и
  применению через Supabase SQL Editor/CLI — отдельный, явно
  подтверждаемый шаг.
- **Ручная проверка на устройстве не выполнена** — невозможна до применения
  миграции.
- **Phase 2 не начата**: date-scoped миграция `children_today`/
  `groups_today`, удаление `AdminBusView.vue`/`ChildrenView.vue`/
  `ResetHistoryPanel.vue`/мёртвого кода `useDays.js`, объединение кнопок
  меню.

# Проверки

- `npm run build` — проходит без ошибок (несколько раз подряд после каждого
  крупного шага).
- Грепом подтверждено: ни один новый реальный файл (`Checkpoint*View.vue`,
  `useCheckpoints.js`, `useSupabaseCheckpoints.js`,
  `useLazyCheckpointProgress.js`, `useGroupEntity.js`,
  `src/components/checkpoints/*`) не импортирует мок-composables — только
  исторические комментарии их упоминают.
- Ручная проверка в браузере/на устройстве — не выполнена (нет инструмента
  браузерной автоматизации в этой сессии; к тому же SQL ещё не применён,
  так что реальный экран сейчас не может успешно загрузить данные).

# Исправления после ревью

(раздел заполняется по итогам REVIEW_REPORT.md, если ревью потребует правок)
