# План реализации тикета 137

## Шаг 1 — грепом подтвердить отсутствие потребителей

Перед удалением каждого файла/функции из списка `137.txt` выполнен грепом
поиск реальных (не-комментарийных) импортов/вызовов по всему `src/`.
Результат:

- `AdminBusView.vue`, `ChildrenView.vue`, `HeadcountView.vue`,
  `useChildPresence.js`, `ResetHistoryPanel.vue`, `BusDetailModal.vue`,
  `GroupDetailModal.vue`, весь `*PrototypeView.vue`/`*Mock.js`/
  `checkpoints-prototype/*` — потребители только внутри самого удаляемого
  набора + `router/index.js`/`App.vue`/`MainView.vue`/`GroupEditView.vue`
  (правятся этим же тикетом). Подтверждено безопасным к удалению.
- `useGroups.js`/`useBusData.js` — реальные импорты (`^import`) только из
  `ChildrenView.vue`/`AdminBusView.vue`/`BusDetailModal.vue`/
  `GroupDetailModal.vue`/`ResetHistoryPanel.vue` (все — из списка выше).
  Все прочие совпадения грепа — комментарии в `CheckpointListView.vue`/
  `CheckpointListPrototypeView.vue`/`useSupabaseCheckpoints.js`
  («…nicht aus useBusData/useGroups…», «AdminBusView.vue
  setupRealtimeSubscription()/useGroups.js»), не импорты. Удаляются
  целиком, как и предполагал `137.txt`.
- `useDays.js`: `startNewDay`/`softReset`/`closeDay`/`isDayStarted`/
  `isDayClosed` — единственный реальный потребитель `AdminBusView.vue`
  (сам удаляется). `fetchDaysList`/`saveDay`/`deleteDay` используются в
  `DaysEditView.vue` — не трогаются.

**Находки сверх списка `137.txt`** (обнаружены тем же грепом, аналогично
находке `GroupEditView.vue`-кнопки при ревью 131 — список тикета не
исчерпывающий, полагаться на грепом-проверку, не на документ):

- `useScanPackets.js` (`fetchPacketsForBus`/`fetchPacketsForGroup`) —
  единственные потребители были `BusDetailModal.vue`/`GroupDetailModal.vue`,
  оба удаляются этим тикетом → composable целиком осиротевает. Не путать с
  `useScanPacket.js` (единственное число, клиентский сборщик пакетов
  тикета 120) — тот активно используется, не трогается.
- `useGroupScanSession.js` — единственный потребитель `HeadcountView.vue`
  (удаляется). Совпадение в `Scanner.vue:457` — комментарий, не импорт.
  Composable целиком осиротевает.
- `src/views/MainView.vue` — кнопка «Kopfzählung» (`goToHeadcount()` →
  `/headcount`), видимая всем авторизованным пользователям с `group_id`
  (не только админам) — отдельная от `GroupEditView.vue`-кнопки,
  описанной в `137.txt`. Ссылается на тот же удаляемый маршрут `/headcount`
  → мёртвая ссылка после удаления `HeadcountView.vue`, убрана вместе с
  ней.
- `src/App.vue` — навигационное меню (не входит в список
  «Затрагиваемые части проекта» `137.txt`) содержит `router-link
  to="/children"` («🧒 Kinder») для админов — станет мёртвой ссылкой
  после удаления маршрута `/children`. Перенаправлен на
  `/admin/checkpoints` («📍 Checkpoints»), не удалён — сохраняет
  быстрый доступ из шапки, аналогично кнопке в `MainView.vue`.

## Шаг 2 — удаление файлов

28 файлов удалено (см. IMPLEMENTATION_REPORT.md за точным списком).

## Шаг 3 — `useDays.js`

Удалены 5 функций Reset-механизма и их экспорт. `fetchDaysList`/
`saveDay`/`deleteDay`/`getCurrentUser` остаются без изменений.

## Шаг 4 — `router/index.js`

Удалены импорты `ChildrenView`/`AdminBusView`, маршруты
`/admin-busses`/`/children`/`/headcount`, весь `/admin/checkpoints-prototype*`
-неймспейс (10 маршрутов). Реальные `/admin/checkpoints*`-маршруты
(тикеты 133/134/135) остаются единственными административными.

## Шаг 5 — `MainView.vue`

Кнопки «Busse»/«Admin Übersicht»/«Checkpoints (Prototyp)» заменены одной
кнопкой «Checkpoints» → `/admin/checkpoints`, `v-if="userStore.isAdmin"`.
Кнопка «Kopfzählung» (находка, см. Шаг 1) удалена вместе с
`goToHeadcount()`. Неиспользуемые `goToAdminBus()`/`goToAdminOverview()`/
`goToCheckpointsPrototype()` заменены одной `goToCheckpoints()`.

## Шаг 6 — `GroupEditView.vue`

Кнопка «Kopfzählung», метод `goToHeadcount()`, вычисляемое свойство
`canShowHeadcountButton` (использовалось только этой кнопкой) — удалены.

## Шаг 7 — `App.vue` (находка, см. Шаг 1)

`router-link to="/children"` → `/admin/checkpoints`, метка «🧒 Kinder» →
«📍 Checkpoints».

## Шаг 8 — `doc/db/remove_reset_events_trigger.sql`

Новый файл-миграция: `DROP TRIGGER trg_on_reset_event_insert` +
`DROP FUNCTION on_reset_event_insert()`. Не применена автоматически —
требует подтверждения пользователем, как и все миграции этой серии
(`137.txt`, п.6). `trg_on_children_today_delete`/
`on_children_today_delete()` намеренно не трогаются (`137.txt`, п.7) —
становятся неактивными (единственный источник `DELETE FROM
children_today` исчезает), но удаление не требуется и не входит в объём.
`reset_events` как таблица не удаляется.

## Что не входит

Согласно `137.txt`: удаление таблиц `reset_events`/`children`/`users`/
`children_today`/`groups_today`; date-scoped миграция (тикет 138); любые
новые функциональные изменения.

## Definition of Done

- `npm run build` без ошибок и без мёртвых импортов (перепроверено
  грепом после удаления).
- Единственная точка входа администратора в `MainView.vue` —
  «Checkpoints».
- Ручная проверка на устройстве (старые маршруты дают 404/редирект,
  новый флоу полностью покрывает функциональность) — не выполнена, нет
  доступа к браузеру/устройству в этой сессии.
