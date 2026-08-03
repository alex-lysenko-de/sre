# Тикет 131 — Архитектурный план: реализация «Контрольная точка» (Checkpoint)

Роль: Software Architect. Основа — `tickets/131/131.txt`, `tickets/130/decision.md`
(гибридная модель, не пересматривается) и `tickets/130/IMPLEMENTATION_PLAN.md`
(исходная архитектурная спецификация). Дополнительная основа — уже
согласованный с пользователем UI-прототип (`tickets/130_2/`, 4 раунда
UX-обратной связи, финальная сущностная модель) и живой набор реальных
экранов/composables, которые он заменяет (`AdminBusView.vue`,
`ChildrenView.vue` и их composables).

## Ключевое решение по охвату (сделано в рамках этого документа)

Реальный интерфейс строится как **замена источника данных поверх уже
одобренного прототипа** (`tickets/130_2`), а не как отдельная более простая
реализация по исходным набросках `130/IMPLEMENTATION_PLAN.md` — именно для
этого и существовал 130_2: согласовать UX до реализации. Переиспользуются:
`ChildLink`/`BetreuerLink`/`GroupLink`/`CountLink`/`EntityListCard`,
Kind-/Betreuer-/Group-карточки, универсальный список. Там, где мок придумывал
несуществующие поля (родители/телефон ребёнка), реальная карточка ребёнка их
не показывает — только реальные поля `children` (как в `ChildDetailView.vue`).

## Решённые в этой сессии открытые вопросы (`131.txt`, «Открытые вопросы»)

- **Cancel-семантика** — явное указание пользователя: кнопка «Удалить
  Checkpoint» физически удаляет запись **и каскадно** её `scan_packets`/
  `scans`, а не помечает статусом CANCELLED. Риск потери данных признан
  пользователем приемлемым (в худшем случае пакет можно переотправить с
  устройства воспитателя — это не реализуется в 131, только принимается как
  обоснование риска). Статус CANCELLED (3) полностью убран из модели — это
  же самое уже валидировано на реальном пользователе в 130_2 (Раунд 1:
  «Cancel» заменён на Reopen/Remove). Каскад реализован **процедурно внутри
  `remove_checkpoint()`** (три `DELETE`), не через `ON DELETE CASCADE` на
  живом `scans.packet_id` — это изменило бы поведение любого будущего
  удаления `scan_packets`, а не только этой кнопки. Обоснование — см.
  `doc/db/checkpoints_functions.sql`, раздел 3.
- **Семантика Finish для Lazy** — без изменений: явная кнопка, с
  предупреждением при незавершённых данных (аналог
  `checkpointHasOpenIssues()` из мока), без авто-завершения.
- **Отображение авто-созданных точек** — переиспользуется уже одобренный
  `CheckpointOriginBadge` («Admin» vs. «Auto (Betreuer X)»).
- **Точные маршруты** — см. «UI изменения» ниже.

## Изменения БД

Полные SQL-файлы уже подготовлены (см. ниже), **не применены к боевой БД в
рамках этой сессии** — применение через Supabase SQL Editor/CLI является
отдельным, явно подтверждаемым шагом (как и миграция 122 в своё время).

- **`doc/db/checkpoints.sql`** — таблица `checkpoints` (без CANCELLED,
  `status CHECK IN (1,2)`), уникальный частичный индекс «не более одной
  открытой на тип в день», колонка `scan_packets.checkpoint_id`, RLS (SELECT
  для `authenticated`, без прав записи — по образцу `doc/db/scan_packets.sql`
  и `doc/db/days_rls.sql`).
- **`doc/db/checkpoints_functions.sql`** — `create_checkpoint(p_type, p_day)`
  / `finish_checkpoint(p_id)` / `reopen_checkpoint(p_id)` (отмена случайного
  Finish — тот же паттерн, что уже провалидирован в 130_2, Раунд 1) /
  `remove_checkpoint(p_id)`, все
  `SECURITY DEFINER` с явной проверкой `role='admin' AND active=true`
  (намеренно не переиспользует существующие `has_role()`/`is_admin()` —
  у обоих нет проверки `active`, что позволило бы деактивированному
  админ-аккаунту удалять данные посещаемости) и `SET search_path = public,
  pg_temp` (защита от search-path hijacking, отсутствующая у
  `submit_scan_packet()`, но обязательная для нового кода). `finish_checkpoint()`
  считает `baseline_children_count` универсально для любого типа через
  `scans ⋈ scan_packets.checkpoint_id = p_id` — не зависит от
  (пока не мигрированных, Phase 2) `children_today`/`groups_today`.
- **`doc/db/checkpoints_scan_packets_extension.sql`** — полная замена
  `submit_scan_packet()`: авто-создание/поиск открытой checkpoint того же
  типа/дня (`INSERT ... ON CONFLICT (day, type) WHERE status=1 DO NOTHING` +
  `SELECT ... ORDER BY id DESC`), запись `checkpoint_id` в `scan_packets`.
  Пакет никогда не отклоняется по этой причине — клиентский контракт
  `useScanPacket.js` (тикет 120) не меняется.

**Явно задокументированное следствие** (не скрыто): после `remove_checkpoint()`
`client_packet_id` удалённых пакетов перестаёт существовать, поэтому повторная
отправка того же пакета из офлайн-очереди воспитателя больше не
дедуплицируется `ON CONFLICT (client_packet_id) DO NOTHING` — она будет
принята как новый пакет (и может авто-создать новую checkpoint). Это ровно
соответствует принятому пользователем риску.

**Не входит в эту сессию (Phase 2, см. ниже)**: миграция
`children_today`/`groups_today` на date-scoped схему из
`tickets/130/IMPLEMENTATION_PLAN.md` — перед её реализацией нужно проверить
по живой схеме, действительно ли существует `groups_today_user_id_key
UNIQUE (user_id)` (последний известный дамп схемы этого не показывает).

## Composable-слой (реальный, трёхслойная конвенция CLAUDE.md)

- `src/composables/useSupabaseCheckpoints.js` (новый) — DB-слой (по образцу
  `useSupabaseUser.js`): `fetchCheckpointsForDay`, `fetchCheckpointDetail`,
  `rpcCreateCheckpoint`/`rpcFinishCheckpoint`/`rpcRemoveCheckpoint`
  (`supabase.rpc(...)` — первое использование RPC в проекте),
  `subscribeToCheckpointsChanges` (Realtime, канал `postgres_changes` на
  `checkpoints`, по образцу `AdminBusView.vue`/`useGroups.js`).
- `src/composables/useCheckpoints.js` (новый) — те же экспортируемые имена и
  форма, что и `useCheckpointsMock.js` (`summarizeCheckpoint`,
  `checkpointHasOpenIssues`, `getBusChildrenBreakdown`,
  `getGroupChildrenBreakdown`, `getBusDelta`, `getGroupDelta`,
  `getCheckpointBetreuerList`, `getBetreuerTodayAssignment`,
  `getDayBaselineCheckpoint`) — именно ради этого мок был спроектирован
  повторяющим будущую сигнатуру: экраны почти не меняются.
- `src/composables/useLazyCheckpointProgress.js` (новый) — «отметился» =
  дети с `scans`, чей `packet_id` ссылается на `scan_packets` с этим
  `checkpoint_id`; «ещё нет» = ростер группы/дня минус это множество.
- **Реальный выигрыш относительно мока**: `useChildren.fetchChildDetailsAndScans(childId)`
  уже существует и не используется ни одним экраном — реальная карточка
  ребёнка вызывает её напрямую для истории сканирований вместо
  синтетической аппроксимации мока.

## UI изменения

Копии `*PrototypeView.vue` без суффикса `Prototype`, без `DebugTag`/`Page
N`/`elN` (были нужны только для UX-согласования 130_2), с реальными
composables вместо мок. Presentational-компоненты переезжают из
`src/components/checkpoints-prototype/` в `src/components/checkpoints/`.
`ChildEditPrototypeView.vue` **не переносится** — кнопка «Bearbeiten» на
реальной карточке ребёнка ведёт на уже существующий `/child-edit/:id`
(`ChildEditView.vue`), покрывающий те же реальные поля.

Маршруты — `/admin/checkpoints`, `/admin/checkpoints/bus/:id`, `/group/:id`,
`/lazy/:id`, `/list`, `/child/:id` (новый путь, отдельный от уже
существующего `/child/:id` — например `/admin/checkpoints/child/:id`, во
избежание коллизии с `ChildDetail`), `/betreuer/:id`, `/group-entity/:id`.

`MainView.vue` получает одну новую кнопку «Checkpoints» (тот же паттерн
кнопок, что и «Busse»/«Admin Übersicht», `v-if="userStore.isAdmin"`) — сами
«Busse»/«Admin Übersicht» на этом этапе **не убираются** (см. этапность).

## Этапность (рекомендация)

- **Phase 1 (эта сессия/следующий заход реализации)**: таблица + RPC +
  расширение `submit_scan_packet()` подготовлены как SQL (не применены),
  реальные composables/экраны, новые маршруты/кнопка меню — **рядом** с
  `/admin-busses`/`/children`, которые продолжают работать как есть.
  `children_today`/`groups_today` пока не date-scoped, поэтому
  `baseline_children_count` в `finish_checkpoint()` не зависит от них
  (считается напрямую из `scans`/`scan_packets`, см. «Изменения БД») — это
  делает Phase 1 самодостаточным, не блокированным на Phase 2.
- **Phase 2 (отдельный заход)**: date-scoped миграция
  `children_today`/`groups_today` (затрагивает `useBusData.js`/`useGroups.js`/
  `useChildPresence` и другие существующие read-пути), удаление Hard/Soft
  Reset/Tag-starten, удаление `AdminBusView.vue`/`ChildrenView.vue`/
  `ResetHistoryPanel.vue`/мёртвых функций `useDays.js`, объединение кнопок
  меню.

Обоснование разделения: это реальные данные посещаемости на боевом проекте;
Phase 1 сам по себе уже большое, первое в проекте использование Postgres RPC
плюс новая таблица+RLS — стоит проверить его на реальном устройстве до более
широкой и рискованной (по признанию самого 130-плана) date-scoped миграции.

## Границы этой сессии (явно не делается)

- SQL не применяется к боевой БД — файлы подготовлены для ревью/применения
  пользователем (или отдельного явно подтверждённого запуска через CLI).
- Date-scoped миграция `children_today`/`groups_today` и удаление
  существующих экранов/composables (Phase 2).
- Полям «родители»/«телефон» ребёнка из мока не добавляется реальный аналог
  в схему `children`.

## Definition of Done (для этой сессии/Phase 1)

- `doc/db/checkpoints.sql`, `doc/db/checkpoints_functions.sql`,
  `doc/db/checkpoints_scan_packets_extension.sql` — подготовлены, идемпотентны,
  соответствуют RLS-паттерну проекта (никаких permissive-политик "на всякий
  случай").
- `useSupabaseCheckpoints.js`/`useCheckpoints.js`/`useLazyCheckpointProgress.js`
  реализованы с теми же именами/формой функций, что и мок.
- Реальные экраны/компоненты перенесены из прототипа, подключены к реальным
  composables, доступны по новым маршрутам, старые `/admin-busses`/`/children`
  не тронуты.
- `npm run build` проходит без ошибок.
- Ручная проверка на устройстве против применённой миграции — отдельный шаг
  после того, как SQL применён (не выполняется в рамках этой сессии).
