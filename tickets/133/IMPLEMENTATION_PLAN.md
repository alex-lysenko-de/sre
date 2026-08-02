# План реализации тикета 133

## Цель

Реальный composable-слой Checkpoint (те же имена/форма, что и
`useCheckpointsMock.js`/`useLazyCheckpointProgressMock.js`) + перенос
энтити-центрированного UI-прототипа (130_2, UX-фидбек Раунд 4) на реальные
данные `children`/`users`/`user_group_day`.

## Слои (трёхслойная конвенция CLAUDE.md)

- `src/composables/useSupabaseCheckpoints.js` — DB-слой (по образцу
  `useSupabaseUser.js`): `fetchCheckpointRowsForDay`, `fetchCheckpointRowById`,
  `fetchUsersByIds`, `fetchScanPacketsForCheckpoint`, `fetchScansForPacketIds`,
  `fetchUserGroupDayAssignment`, `rpcCreateCheckpoint`/`rpcFinishCheckpoint`/
  `rpcReopenCheckpoint`/`rpcRemoveCheckpoint` (первое использование
  `supabase.rpc()` в проекте), `subscribeToCheckpointsChanges`.
- `src/composables/useCheckpoints.js` — бизнес-логика, те же экспортируемые
  имена, что и `useCheckpointsMock.js`. Переводит сырые Postgres-исключения
  RPC (`doc/db/checkpoints.sql`, «Error contract») в форму ошибок мока
  (`{error:'ALREADY_OPEN', existingId}` и т.д.).
- `src/composables/useLazyCheckpointProgress.js` — «отметился» = дети со
  `scans`, чей `packet_id` → `scan_packets.checkpoint_id`; «последняя
  отметка» = `MAX(scan_packets.received_at)`.
- `src/composables/useBetreuerEntity.js` — `getBetreuerById`/
  `getBetreuerByName`/`getBetreuerByIds` (батч), читает `users`, без
  фильтра по `role` (открытый вопрос 133.txt п.8 — решено не фильтровать,
  `isAdmin` передаётся отдельным полем для `BetreuerLink.vue`, как в моке).
- `src/composables/useChildren.js` — расширен `getChildById`/
  `getChildrenByGroup` (реальные запросы, без `parentA/parentB/phone`).

## Ключевое архитектурное решение: агрегация вложенных `buses`/`groups`

В моке `cp.buses`/`cp.groups` были статичными полями объекта, вычисленными
один раз при создании. В реальности их нет в таблице `checkpoints` — они
вычисляются "на лету" в `useCheckpoints.js` (`buildBusesForCheckpoint`/
`buildGroupsForCheckpoint`) из `scan_packets`/`scans`, и **встраиваются**
в объект checkpoint при каждом `fetchCheckpointsForDay()`/
`fetchCheckpointDetail()` — ровно то же имя полей (`cp.buses`/`cp.groups`),
чтобы `CheckpointBusPrototypeView.vue`/`CheckpointGroupPrototypeView.vue`
(тикет 134) могли работать почти без изменений (`v-for="bus in
checkpoint.buses"` и т.п. — подтверждено чтением этих файлов).

Правила агрегации разные по типу (decision.md §5):
- **BUS** — Union всех пакетов (`buildBusesForCheckpoint`): присутствующие
  дети — объединение по всем пакетам этого автобуса в этой точке.
- **GROUP** — Last Packet Wins (`buildGroupsForCheckpoint`): текущий
  результат группы — только из последнего по `received_at` пакета этой
  группы в этой точке (не объединение). Список Betreuer при этом собирается
  по ВСЕМ пакетам группы (более полная картина, не только последнего
  автора) — не влияет на подсчёт детей.

## Отклонение от сигнатуры мока (неизбежное, задокументировано в шапке
`useCheckpoints.js`)

`getBusChildrenBreakdown`/`getGroupChildrenBreakdown`/`getBusDelta`/
`getGroupDelta` были синхронными в моке (читали уже готовые `cp.buses`/
`cp.groups`) — здесь они `async`, так как дополнительно требуют полный
ростер (`fetchAllChildren()`) или загрузку tagesbasis-checkpoint
(`getDayBaselineCheckpoint()`). `getCheckpointBetreuerList` остался
синхронным (читает только уже встроенные `cp.buses`/`cp.groups`).

## Функции сверх буквального списка 133.txt

- `fetchGroupEntity(groupId, day)` в `useCheckpoints.js` — реальный аналог
  `useGroupEntityMock.fetchGroupEntity()`, не назван по имени в 133.txt, но
  необходим для `GroupEntityView.vue` (Цель п.2 тикета). Размещён в
  `useCheckpoints.js`, а не в отдельном файле — как и в моке, использует
  исключительно уже вычисленные Checkpoint-данные.
- `getBetreuerByIds`/`fetchUsersByIds` (батч-версии) — не в 133.txt
  дословно, нужны для разрешения имён авторов пакетов/сканов без N+1
  запросов на строку.

## UI (без изменений логики компонентов, только источники данных/пути)

- `src/components/checkpoints/{ChildLink,BetreuerLink,GroupLink,CountLink,
  EntityListCard}.vue` — копии из `checkpoints-prototype/`, единственное
  изменение — маршруты без `-prototype`.
- `src/views/{ChildCardView,BetreuerCardView,GroupEntityView,
  EntityListView}.vue` — копии `*PrototypeView.vue`, без `DebugTag`/
  `Page N`/`elN` (нужны были только для UX-согласования 130_2), реальные
  composables, «Bearbeiten» → существующий `/child-edit/:id`
  (`ChildEditView.vue`, именованный маршрут `ChildDetailEdit`) вместо
  параллельного `ChildEditPrototypeView.vue`.
- Карточка ребёнка: `useChildren().fetchChildDetailsAndScans(childId)`
  (существовала, не использовалась) вместо `useScanHistoryMock.js`; имена
  Betreuer в истории сканов разрешаются батчем через `getBetreuerByIds`.
- Новые маршруты в `src/router/index.js`: `/admin/checkpoints/list`,
  `/admin/checkpoints/child/:id`, `/admin/checkpoints/betreuer/:id`,
  `/admin/checkpoints/group-entity/:id` — без кнопки в `MainView.vue`
  (по аналогии с решением тикета 134: прямой переход по маршруту, кнопка
  меню — тикет 137).

## Definition of Done

- Все файлы реализованы, `npm run build` проходит без ошибок.
- Ручная проверка на реальной БД **не выполнена в этой сессии** — ticket 132
  (`doc/db/checkpoints.sql`) ещё не применён к боевой БД (см.
  `tickets/132/IMPLEMENTATION_REPORT.md`), что 133.txt указывает как
  предусловие «к моменту начала этого тикета должен быть применён к БД».
  Разработка велась строго по документированному контракту схемы/RPC/
  ошибок (`doc/db/checkpoints.sql`), без доступа к живой БД для проверки.
