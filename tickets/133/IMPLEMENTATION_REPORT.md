# Что сделано

## Composable-слой (реальный)

- `src/composables/useSupabaseCheckpoints.js` (новый) — DB-слой:
  `fetchCheckpointRowsForDay`/`fetchCheckpointRowById`/`fetchUsersByIds`/
  `fetchScanPacketsForCheckpoint`/`fetchScansForPacketIds`/
  `fetchUserGroupDayAssignment`, `rpcCreateCheckpoint`/`rpcFinishCheckpoint`/
  `rpcReopenCheckpoint`/`rpcRemoveCheckpoint` (первое `supabase.rpc()` в
  проекте), `subscribeToCheckpointsChanges`.
- `src/composables/useCheckpoints.js` (новый) — те же имена/форма, что и
  `useCheckpointsMock.js`: `CHECKPOINT_TYPE`, `CHECKPOINT_STATUS`,
  `todayString`, `fetchCheckpointsForDay`, `fetchCheckpointDetail`,
  `createCheckpoint`/`finishCheckpoint`/`reopenCheckpoint`/`removeCheckpoint`,
  `isOverdue`, `summarizeCheckpoint`, `checkpointHasOpenIssues`,
  `getBusChildrenBreakdown`/`getGroupChildrenBreakdown`,
  `getDayBaselineCheckpoint`, `getBusDelta`/`getGroupDelta`,
  `getCheckpointBetreuerList`, `getBetreuerTodayAssignment` (через
  `user_group_day`, не через сканирование checkpoints, как в моке — 133.txt
  п.5), плюс `fetchGroupEntity` (см. «Отклонения»). Вычисляет `cp.buses`/
  `cp.groups` "на лету" из `scan_packets`/`scans` по правилам агрегации
  decision.md §5 (BUS = union, GROUP = last packet wins) и встраивает их в
  объект checkpoint — тот же приём, что и в моке, чтобы 134/135 могли
  переиспользовать `checkpoint.buses`/`checkpoint.groups` почти без правок.
- `src/composables/useLazyCheckpointProgress.js` (новый) —
  `fetchLazyCheckpointProgress(checkpointId)`: «гемельдет» из
  `scans`⋈`scan_packets.checkpoint_id`, «последняя отметка» =
  `MAX(scan_packets.received_at)`.
- `src/composables/useBetreuerEntity.js` (новый) — `getBetreuerById`/
  `getBetreuerByName`/`getBetreuerByIds`, читает `users`, без фильтра по
  `role` (открытый вопрос 133.txt решён — см. IMPLEMENTATION_PLAN.md).
- `src/composables/useChildren.js` — расширен `getChildById`/
  `getChildrenByGroup` (реальные запросы, camelCase `groupId` для
  совместимости с перенесённым `ChildLink.vue`).

## UI

- `src/components/checkpoints/{ChildLink,BetreuerLink,GroupLink,CountLink,
  EntityListCard}.vue` — копии из `checkpoints-prototype/`, маршруты без
  `-prototype`.
- `src/views/{ChildCardView,BetreuerCardView,GroupEntityView,
  EntityListView}.vue` — копии `*PrototypeView.vue` без `DebugTag`/`Page N`,
  реальные composables. «Bearbeiten» на карточке ребёнка ведёт на
  существующий `ChildEditView.vue` (маршрут `ChildDetailEdit`), не создан
  параллельный редактор.
- `src/router/index.js` — добавлены `/admin/checkpoints/list`,
  `/admin/checkpoints/child/:id`, `/admin/checkpoints/betreuer/:id`,
  `/admin/checkpoints/group-entity/:id` (без правки `MainView.vue` — прямой
  переход по маршруту, кнопка меню — тикет 137, по аналогии с 134.txt).

# Отклонения от 133.txt/IMPLEMENTATION_PLAN.md

- `getBusChildrenBreakdown`/`getGroupChildrenBreakdown`/`getBusDelta`/
  `getGroupDelta` стали `async` (в моке были синхронными) — неизбежно, они
  дополнительно читают полный ростер детей/tagesbasis-checkpoint из БД.
  Задокументировано в шапке `useCheckpoints.js`. Ticket 134/135 должны
  учитывать это (`await`).
- `fetchGroupEntity(groupId, day)` добавлена в `useCheckpoints.js` — не
  названа по имени в 133.txt, но необходима для `GroupEntityView.vue`
  (Цель п.2). Реальный аналог `useGroupEntityMock.js`, использует только
  уже вычисленные Checkpoint-данные, как и мок.
- `getBetreuerByIds`(batch) добавлена сверх списка — нужна для разрешения
  имён Betreuer в истории сканов ребёнка без N+1 запросов.

# Применение к боевой БД / ручная проверка

Разработка велась по документированному контракту схемы/RPC/ошибок из
`doc/db/checkpoints.sql`, без прямого доступа к БД из этой сессии для
проверки запросов. По ходу работы обнаружено (см. обновлённый
`tickets/132/IMPLEMENTATION_REPORT.md`): миграция 132 на самом деле уже
применена к боевой БД — актуальный дамп `backup/database/schema.sql`
содержит таблицу `checkpoints`, все FK/индексы/RLS-политику и все четыре
RPC-функции, побайтово совпадающие с `doc/db/checkpoints.sql`. Это снимает
формальную блокировку по предусловию 133.txt («132 должен быть применён к
БД»), но **не заменяет** ручную проверку:

Не выполнено в этой сессии (у ассистента нет доступа к браузеру/устройству):
- Ручная проверка каждой функции в консоли против применённой БД.
- Ручная проверка на устройстве/в браузере (карточки ребёнка/Betreuer/
  группы, `/admin/checkpoints/list`, `/admin/checkpoints/child/:id` и т.д. —
  прямым переходом по URL, кнопки меню пока нет, см. тикет 137).

`npm run build` — пройден без ошибок.

# Зафиксировано в дашборде

`tickets/dashboard.md`, `tickets/133/state.txt` → `DEVELOPMENT_DONE`
(разработка готова; применение 132 к БД + ручная проверка 132 и 133 —
следующий шаг, отдельно подтверждаемый пользователем).
