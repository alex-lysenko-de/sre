# Что сделано

## Компоненты

- `src/components/checkpoints/{CheckpointCreateModal,CheckpointStatusBadge,
  CheckpointTypeBadge,CheckpointOriginBadge}.vue` (новые) — копии из
  `checkpoints-prototype/`, без `DebugTag`, импорт переключён на
  `@/composables/useCheckpoints` (реальный). `CheckpointOriginBadge.vue`
  ссылается на `./BetreuerLink.vue`, который уже лежит в этой же папке
  (тикет 133) — правка не потребовалась.

## Экраны

- `src/views/CheckpointListView.vue` (новый) — список/история точек дня:
  `fetchCheckpointsForDay(todayString())` + `summarizeCheckpoint()` на
  каждую, создание через `CheckpointCreateModal` → `createCheckpoint(type)`
  с обработкой `{error:'ALREADY_OPEN', existingId}`, клик по карточке →
  переход в `/admin/checkpoints/{bus|group|lazy}/:id` по `cp.type`. Бейдж
  «Auto (Betreuer X)» / «Admin» через `CheckpointOriginBadge` — не на
  карточке списка (как и в прототипе, только в деталях), «несколько
  одновременно открытых одного типа» — как аномалия (`anomalousIds`).
- `src/views/CheckpointBusView.vue` (новый) — заголовок
  (`summarizeCheckpoint`, сравнение с `baseline_children_count`), таблица
  автобусов (`checkpoint.buses`, уже даёт `useCheckpoints.js`) с
  Kinder/Betreuer/пакетами раунда (сворачиваемый список), `getBusDelta` per
  Bus. Finish (предупреждение при `checkpointHasOpenIssues`)/Reopen/Remove
  (подтверждение). Ссылки на карточки через `ChildLink`/`BetreuerLink`
  (тикет 133, внутри `EntityListView.vue`/`EntityListCard.vue`, сюда не
  копировались — открываются через `CountLink` → `/admin/checkpoints/list`).
- `src/views/CheckpointGroupView.vue` (новый) — аналогично, список групп
  (`checkpoint.groups`), статус-цвет карточки (ok/missing/extra/none),
  Morgen/Aktuell, `Differenz`, ссылка на группу через `GroupLink`.
  Finish/Reopen/Remove идентичны Bus.
- `src/router/index.js` — добавлены `/admin/checkpoints` (`CheckpointList`),
  `/admin/checkpoints/bus/:id` (`CheckpointBus`),
  `/admin/checkpoints/group/:id` (`CheckpointGroup`). `MainView.vue` не
  тронут (см. `134.txt`, заголовок — кнопка меню в тикете 137).

# Отклонения от 134.txt/IMPLEMENTATION_PLAN.md

- `getBusChildrenBreakdown`/`getGroupChildrenBreakdown`/`getBusDelta` стали
  вызываться асинхронно и одноразово в `load()` вместо синхронного
  `computed()` прототипа (неизбежное следствие того, что тикет 133 сделал
  эти функции `async`) — результат кладётся в `ref` (`breakdownCounts`,
  `busDeltas`).
- Каждый из трёх экранов сам открывает Realtime-канал через
  `supabase.channel(...)`, слушая **и** `checkpoints`, **и** `scan_packets`
  — composable `subscribeToCheckpointsChanges()` (тикет 133) слушает только
  `checkpoints` и не реагирует на новые пакеты в уже открытой точке, а без
  этого числа на экране не обновлялись бы «без ручного действия» (явное
  требование `134.txt`, «Результат выполнения тикета»). См.
  IMPLEMENTATION_PLAN.md, раздел «Realtime».
- Плитка «Gesamt» (Kinder/Betreuer) главного экрана из прототипа не
  перенесена — была синтетической заглушкой без реального источника данных
  и не упомянута в `134.txt` п.1. См. IMPLEMENTATION_PLAN.md.

# Применение к боевой БД / ручная проверка

Тикет 132 подтверждённо применён к боевой БД (см.
`tickets/132/IMPLEMENTATION_REPORT.md`, обнаружено в сессии тикета 133).
Композабл-слой тикета 133 (на котором строится этот тикет) также не
проверялся вручную на устройстве.

Не выполнено в этой сессии (нет доступа к браузеру/устройству):
- Авто-создание Bus/Group-точки по первому пакету на реальном скане.
- Finish/Reopen/Remove на боевой БД (включая проверку RPC-ошибок
  `ALREADY_OPEN`/`NOT_OPEN`/`NOT_FINISHED`/`NOT_ADMIN` в интерфейсе).
- Реальная Realtime-проверка (второе устройство/вкладка отправляет пакет —
  первое обновляется без ручного действия).

`npm run build` — пройден без ошибок (все три экрана — отдельные
lazy-loaded чанки, размер бандла не изменился относительно уже
существовавшего предупреждения о `index-*.js` >500kB).

# Зафиксировано в дашборде

`tickets/dashboard.md`, `tickets/134/state.txt` → `DEVELOPMENT_DONE`
(разработка готова; ручная проверка на устройстве — следующий шаг,
отдельно подтверждаемый пользователем).

# Правки по REVIEW_REPORT.md

- **Major** (бейдж происхождения обязателен на каждой строке списка,
  `134.txt` п.1) — исправлено: `CheckpointListView.vue` теперь рендерит
  `<CheckpointOriginBadge :created-by="cp.created_by" />` в
  `cp-item-footer` каждой карточки. `cp.created_by` уже приходит в нужной
  форме (`{id, name, isAdmin}`) из `fetchCheckpointsForDay`
  (`useCheckpoints.js:67`), правка чисто на уровне шаблона/импорта.
  `npm run build` перепройден, ошибок нет.
- **Minor** (клик по Lazy-карточке ведёт на несуществующий маршрут до
  135) — исправлено минимальной защитой: `openDetail()` в
  `CheckpointListView.vue` теперь перехватывает `CHECKPOINT_TYPE.LAZY` и
  показывает `alert()` вместо перехода на `/admin/checkpoints/lazy/:id`
  (которого пока нет — в роутере нет catch-all/404, переход туда тихо
  ничего не показывает). Это реальный, а не только гипотетический риск:
  `CheckpointCreateModal.vue` уже позволяет создать Lazy-точку из этого
  же экрана.
- **Suggestion** (сворачивание «чистых» групп) — без изменений,
  сознательно. `130.txt:225-227` формулирует это как «можно сворачивать»
  (мягкая цель компактности), а не как обязательное требование; текущее
  решение (цветовая дифференциация строки) унаследовано 1:1 из уже
  одобренного прототипа 130_2, и его переработка в аккордеон вне
  периметра `134.txt` — не регрессия этого тикета. Оставлено как принятый
  известный пробел, который стоит пересмотреть отдельно (например, в
  137, при выводе `ChildrenView.vue` из эксплуатации), а не как часть
  134.
