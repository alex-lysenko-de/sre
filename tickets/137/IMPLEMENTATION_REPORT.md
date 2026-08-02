# Что сделано

## Удалённые файлы (28)

Views:
- `src/views/AdminBusView.vue`, `ChildrenView.vue`, `HeadcountView.vue`
- `src/views/EntityListPrototypeView.vue`, `GroupEntityPrototypeView.vue`,
  `ChildEditPrototypeView.vue`, `ChildCardPrototypeView.vue`,
  `CheckpointListPrototypeView.vue`, `CheckpointLazyPrototypeView.vue`,
  `CheckpointGroupPrototypeView.vue`, `CheckpointBusPrototypeView.vue`,
  `BetreuerCardPrototypeView.vue`

Components:
- `src/components/ResetHistoryPanel.vue`, `BusDetailModal.vue`,
  `GroupDetailModal.vue`
- `src/components/checkpoints-prototype/` (весь каталог, 10 файлов:
  `BetreuerLink.vue`, `CheckpointCreateModal.vue`,
  `CheckpointOriginBadge.vue`, `CheckpointStatusBadge.vue`,
  `CheckpointTypeBadge.vue`, `ChildLink.vue`, `CountLink.vue`,
  `DebugTag.vue`, `EntityListCard.vue`, `GroupLink.vue`)

Composables:
- `src/composables/useChildPresence.js`, `useGroups.js`, `useBusData.js`
- `src/composables/useBetreuerEntityMock.js`, `useCheckpointsMock.js`,
  `useChildEntityMock.js`, `useGroupEntityMock.js`,
  `useLazyCheckpointProgressMock.js`, `useMockConstants.js`,
  `useScanHistoryMock.js`
- `src/composables/useScanPackets.js`, `useGroupScanSession.js`
  (находки сверх списка `137.txt` — см. IMPLEMENTATION_PLAN.md, Шаг 1;
  оба целиком осиротели как прямое следствие удаления
  `BusDetailModal.vue`/`GroupDetailModal.vue`/`HeadcountView.vue`)

Все удаления подтверждены грепом реальных (`^import`) потребителей по
всему `src/` — не удалялось «по списку из документа вслепую» (`137.txt`,
п.1). Единственные найденные совпадения вне удаляемого набора — это
исторические комментарии (например «reales Pendant zu
CheckpointBusPrototypeView.vue» в `CheckpointBusView.vue`), не импорты —
оставлены как есть, это допустимая документирующая ссылка на завершённую
миграцию, не мёртвый код.

## `src/composables/useDays.js`

Удалены `startNewDay`/`softReset`/`closeDay`/`isDayStarted`/
`isDayClosed` и их экспорт (единственный потребитель — удалённый
`AdminBusView.vue`). `fetchDaysList`/`saveDay`/`deleteDay`/
`getCurrentUser` не изменены (используются `DaysEditView.vue`).

## `src/router/index.js`

- Убраны импорты `ChildrenView`, `AdminBusView`.
- Убраны маршруты `/admin-busses`, `/children`, `/headcount`.
- Убран весь неймспейс `/admin/checkpoints-prototype*` (10 маршрутов,
  включая UX-Feedback-Runde-4-блок).
- Реальные `/admin/checkpoints*`-маршруты (133/134/135) остались без
  изменений — теперь единственные административные.

## `src/views/MainView.vue`

- Кнопки «Busse» (`/admin-busses`), «Admin Übersicht» (`/children`),
  «Checkpoints (Prototyp)» (`/admin/checkpoints-prototype`) заменены
  одной кнопкой «Checkpoints» → `/admin/checkpoints`,
  `v-if="userStore.isAdmin"`.
- Кнопка «Kopfzählung» (`goToHeadcount()` → `/headcount`, была видна
  всем авторизованным с `group_id`, не только админам) — удалена как
  находка сверх списка `137.txt` (та же причина: ведёт на удалённый
  маршрут).
- `goToAdminBus()`/`goToAdminOverview()`/`goToCheckpointsPrototype()`
  заменены на `goToCheckpoints()`.

## `src/views/GroupEditView.vue`

Кнопка «Kopfzählung», `goToHeadcount()`, вычисляемое свойство
`canShowHeadcountButton` — удалены (`137.txt`, «Что прочитать»,
пункт про `GroupEditView.vue:66-68, 234-235`).

## `src/App.vue` (находка сверх списка `137.txt`)

Навигационное меню шапки (не упомянуто в «Затрагиваемые части проекта»
`137.txt`, но содержало `router-link to="/children"` — прямую мёртвую
ссылку после удаления маршрута) — перенаправлено на
`/admin/checkpoints`, текст «🧒 Kinder» → «📍 Checkpoints».

## `doc/db/remove_reset_events_trigger.sql` (новый файл)

`DROP TRIGGER IF EXISTS trg_on_reset_event_insert ON reset_events;` +
`DROP FUNCTION IF EXISTS on_reset_event_insert();`. Не редактирует
`doc/db_triggers.sql` задним числом — отдельный файл-миграция, как того
требует конвенция проекта. **Не применена к БД** — ждёт подтверждения
пользователя.

`reset_events` как таблица — не удалена (`137.txt`, п.7, «Что не
входит»). `trg_on_children_today_delete`/`on_children_today_delete()`
намеренно оставлены как есть — станут неактивными (их единственный
источник срабатывания исчезает вместе с `on_reset_event_insert()`), но
это не мешает и не входит в объём тикета.

# Отклонения от 137.txt/IMPLEMENTATION_PLAN.md

Четыре находки сверх явного списка `137.txt` (детали — см.
IMPLEMENTATION_PLAN.md, Шаг 1): осиротевшие `useScanPackets.js` и
`useGroupScanSession.js`, мёртвая кнопка «Kopfzählung» в
`MainView.vue` (отдельная от `GroupEditView.vue`), мёртвая ссылка
`/children` в `App.vue`. Все — прямое техническое следствие удалений,
явно перечисленных в `137.txt`; исправлены в рамках того же тикета,
т.к. без этого сборка содержала бы либо мёртвый код (осиротевшие
composables), либо битые ссылки в UI (кнопка/nav-link на удалённые
маршруты) — то есть `npm run build` "без мёртвых импортов" и "единственная
точка входа администратора" (Результат выполнения тикета) не были бы
выполнены буквально.

Других отклонений от шагов `137.txt`/`IMPLEMENTATION_PLAN.md` нет.

# Применение к боевой БД / ручная проверка

Не выполнено в этой сессии (нет доступа к браузеру/устройству/БД):
- `doc/db/remove_reset_events_trigger.sql` не применён к БД.
- Ручная проверка: старые маршруты (`/admin-busses`, `/children`,
  `/headcount`) дают 404/редирект по политике приложения (роутер их
  просто не знает — `router.beforeEach` не содержит explicit-404-
  обработки для несуществующих путей, поведение зависит от Vue Router
  default; не проверено на устройстве).
- Ручная проверка: новый флоу («Checkpoints» → List/Bus/Group/Lazy)
  полностью покрывает прежнюю функциональность старых Bus/Group/
  Headcount-экранов.

`npm run build` — пройден без ошибок. PWA precache: **59 записей,
3934.60 KiB** (было 94 записи, 4065.48 KiB на момент тикета 136) —
заметное сокращение, соответствует объёму удалённого кода. Главный
бандл `index-*.js`: **625.71 kB** (было 667.85 kB) — уменьшился, а не
вырос, несмотря на объединение кода в `MainView.vue`. Финальный грепом-
проход подтвердил отсутствие реальных (`^import`) ссылок на удалённые
файлы/composables во всём `src/`.

# Зафиксировано в дашборде

`tickets/dashboard.md`, `tickets/137/state.txt` → `DEVELOPMENT_DONE`.
