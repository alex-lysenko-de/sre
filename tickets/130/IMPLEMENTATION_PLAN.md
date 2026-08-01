# Тикет 130 — Архитектурный план: сущность «Контрольная точка» (Checkpoint) и редизайн интерфейса администратора

Роль: Software Architect. Документ описывает решение, но не применяет его —
код и БД не меняются в рамках 130 (по аналогии с парой тикетов 121→122).
Основа — `tickets/130/130.txt` в его текущем виде и
`tickets/130/decision.md` (итоговое архитектурное решение по модели
контрольной точки — гибридная модель авто-создания/явного завершения,
см. «Новая таблица `checkpoints`» ниже). Сущность переименована из
«Перекличка (Roll Call)» в «Контрольная точка (Checkpoint)» — точнее
отражает назначение: не непрерывный процесс сканирования, а фиксация
результата в конкретный момент (`decision.md`, «Почему отказались от
автоматического завершения предыдущей переклички»).

# Цель

Спроектировать:

1. Новую сущность **«Контрольная точка» (Checkpoint)** на уровне данных —
   таблицу, связь со `scan_packets`, правило приёма пакетов (авто-создание
   контрольной точки по первому пакету соответствующего типа, без отказов
   воспитателю), функции создания/завершения/отмены. Модель зафиксирована
   в `tickets/130/decision.md` и не пересматривается этим документом.
2. Замену механизма "Tag starten"(Hard Reset)/"Soft Reset"/"Tag schließen"
   на автоматическую границу дня + baseline-снимок присутствия, привязанный
   к первой завершённой контрольной точке дня (решение зафиксировано в
   `130.txt:206`).
3. Новый интерфейс администратора: список/история контрольных точек,
   создание, мониторинг и детальный просмотр по трём типам (Bus/Group/
   Lazy) — взамен `AdminBusView.vue` и функциональной части
   `ChildrenView.vue` ("Gruppenübersicht").

Результат этого документа — спецификация для отдельного тикета реализации.
Ничего из раздела «Изменения БД»/«API изменения» не применяется к реальной
базе в рамках 130.

# Анализ текущей архитектуры

## Что есть сейчас

- **`AdminBusView.vue`** (`/admin-busses`, только admin) — общая сводка
  Kinder/Betreuer (:17-56, агрегируется из `fetchBusData()`), кнопка
  "Aktualisieren" (:60-69 → `loadBusData()`, при том что экран уже подписан
  на Realtime, см. ниже — кнопка избыточна уже сегодня), "Tag starten"
  (:71-81 → `startDay()` → `useDays.startNewDay()`), "Soft Reset" (:82-92 →
  `performSoftReset()` → `useDays.softReset()`), `ResetHistoryPanel.vue`
  (:96-100, показывает `reset_events` за день), таблица автобусов (:102-186,
  клик по строке → `openBusDetail()` → `BusDetailModal.vue`).
- **`ChildrenView.vue`** (`/children`, компонент внутри называется
  `AdminGroupView`, только admin) — своя кнопка "Aktualisieren" (:39-51),
  карточка "Zusammenfassung" (Morgen/Aktuell, предупреждение "Achtung! N
  Kind(er) fehlen" при :67-70), таблица групп (:75-135: status-dot
  `getStatusClass()` :201-206, `Differenz` через `formatDifference()`
  :208-218, клик на значок конверта → `openGroupDetail()` :220-223 →
  `GroupDetailModal.vue`). Данные — `useGroups.js`: `fetchGroupsData()`
  (:16-83, джойн `groups_today` + `user_group_day`), Realtime —
  `subscribeToGroupsChanges()` (:219-241, канал `groups_today_changes`).
- Обе страницы уже полностью на Realtime (`AdminBusView.vue:480-534` —
  канал `bus-data-changes`, слушает `children_today`/`user_group_day`/
  `reset_events` INSERT; `ChildrenView.vue`/`useGroups.js` — канал
  `groups_today_changes`) — ручные кнопки "Aktualisieren" на обоих экранах
  дублируют то, что уже приходит само; это уже так сегодня, не новая
  проблема 130, но подтверждает, что новым экранам ручное обновление не
  нужно.
- **`useDays.js`** — `startNewDay(date)` (:172-202, INSERT в `reset_events`
  `event_type=1`), `softReset(date)` (:209-240, `event_type=2`),
  `closeDay(date)` (:247-278, `event_type=0`, нигде не вызывается в UI),
  `isDayStarted()`/`isDayClosed()` (:114-165, читают `reset_events`).
- **Триггер `on_reset_event_insert`** (`doc/db_triggers.sql:123-199`) —
  единственное место, где реально что-то происходит при вставке в
  `reset_events`:
  - `event_type=0` — `DELETE FROM children_today; DELETE FROM groups_today;`
    (:139-144);
  - `event_type=1` — **если это первый `event_type=1` за день**:
    `groups_today.children_today = children_now`, затем `children_now = 0`
    (:150-157, снимок "утро"); если не первый — только `children_now = 0`
    (:158-164); в обоих случаях `children_today.presence_now = 0` (:167-168);
  - `event_type=2` — то же самое, что "не первый" случай `event_type=1`:
    только `presence_now`/`children_now` в 0 (:173-181), без снимка.

  Важный вывод: сегодняшний "Tag starten" в 90% случаев (после первого
  раза за день) технически неотличим от "Soft Reset" — разница только в
  том, что случилось при *первом* нажатии за день. Это прямо подтверждает
  корректность решения из `130.txt:206` — baseline-снимок должен быть
  привязан не к кнопке, а к событию "первое завершение переклички за
  день", а не дублироваться как отдельная концепция.
- **`scan_packets`** (`doc/db/scan_packets.sql`) — уже есть типизация
  `type` (`1=BUS,2=GROUP,3=CHECKIN`, :30,42), взаимоисключающий
  `bus_id`/`group_id` по типу (:43-47), идемпотентность по
  `client_packet_id` (:41, ON CONFLICT :216-225), атомарная вставка
  заголовка+детей одной функцией `submit_scan_packet()` (:183-241, вызывается
  только из Edge Function `submit-scan-packet` через `service_role` — не
  напрямую пользователем, :14). Единственная нужная для 130 точка
  расширения — это уже существующая функция.
- **`admin_logs`** (`backup/database/schema.sql:3593-3600`) — `admin_id
  uuid`, `target_user_id uuid`, `action text`, `details jsonb`. Не
  используется нигде в `src/` (подтверждено грепом). Технически хуже
  подходит, чем даже "адаптация `reset_events`": все таблицы, с которыми
  реально работает перекличка (`scan_packets.author_id`, `reset_events.
  user_id`, `users.id`) используют `bigint`-первичный ключ `users.id`, а
  не `auth.uid()` (`users.user_id uuid`). `admin_logs.admin_id` — `uuid`,
  то есть он бы ссылался на другой ключ, чем весь остальной домен
  переклички, и потребовал бы либо денормализации, либо join через
  `users.user_id`. Это дополнительный (не упомянутый в 130.txt) аргумент
  в пользу решения "новая таблица", уже принятого в `130.txt:93`.
- **RLS-риск, который нельзя повторить** (`vault/03-База-данных/
  RLS-политики.md`, "Неотозванные широкие legacy-политики") — у
  `reset_events`/`children_today`/`groups_today` рядом с корректными
  узкими admin-only-политиками остались старые permissive-политики
  `USING/WITH CHECK (true)` для `authenticated`, которые эффективно сводят
  реальные права на запись к "любой залогиненный пользователь", несмотря
  на формально корректные узкие правила. Новая таблица `checkpoints` должна
  создаваться сразу и только с узкими политиками — ниже это явно
  зафиксировано как требование, не рекомендация.
- **Кто ведёт домен переклички сегодня**: воспитатели через
  `ScannerBusView.vue`/`ScannerGroupView.vue`/`ScannerCheckinView.vue`
  (тикет 120, все три вызывают `useScanPacket.submitPacket()` →
  Edge Function) и встроенную панель в `HeadcountView.vue` (тикет 123).
  Понятия "раунд переклички" не существует — только отдельные пакеты и
  агрегаты `children_today`/`groups_today`.

# Затрагиваемые модули

| Модуль | Тип изменения |
|---|---|
| `AdminBusView.vue` | заменяется новым экраном списка/создания контрольных точек |
| `ChildrenView.vue` (`AdminGroupView`) | функциональность мониторинга группы переезжает в детальный экран Group Checkpoint; экран как отдельный маршрут — на пересмотр (см. «UI изменения») |
| `BusDetailModal.vue` | логика (сводка + список пакетов) переиспользуется в новом детальном экране Bus Checkpoint, но не как модалка, а как отдельный экран/раздел |
| `GroupDetailModal.vue` | аналогично — основа для Group Checkpoint detail |
| `ResetHistoryPanel.vue` | заменяется списком/историей "Checkpoints"; сам компонент выходит из употребления |
| `useDays.js` | `startNewDay`/`softReset`/`closeDay`/`isDayStarted`/`isDayClosed` теряют вызывающий UI, становятся мёртвым кодом (удаление — в тикете реализации, не в 130) |
| `useBusData.js` | `getResetHistory()` теряет потребителя вместе с `ResetHistoryPanel.vue`; `fetchBusData`/`fetchBusChildren`/`fetchBusBetreuer` переиспользуются (с добавлением фильтра по контрольной точке) |
| `useGroups.js` | `fetchGroupsData`/`fetchGroupDetails` переиспользуются как основа для Group Checkpoint monitoring |
| `useScanPackets.js` | `fetchPacketsForBus`/`fetchPacketsForGroup` получают новый параметр фильтрации по `checkpoint_id` |
| `useScanPacket.js` (клиент, тикет 120) | не меняется — уже отправляет `type`/`date`; серверная часть сама находит или авто-создаёт открытую контрольную точку по `type_code`+`date` (`decision.md`), без изменений клиентского контракта и без новых кодов ошибок |
| `doc/db/scan_packets.sql` / `submit_scan_packet()` | расширяется авто-поиском/авто-созданием открытой контрольной точки + записью `checkpoint_id`; пакет никогда не отклоняется по этой причине |
| `doc/db_triggers.sql` / `on_reset_event_insert` | логика "первый reset дня → снимок" переносится в новую `finish_checkpoint()`; сам триггер становится ненужным вместе с `reset_events` (удаление — вне 130) |
| `children_today`/`groups_today` (схема) | добавляется колонка `date`; unique-констрейнты `(child_id)`/`(group_id)`/`(user_id)` заменяются на `(child_id, date)`/`(group_id, date)`/`(user_id, date)` — механизм автоматической границы дня без `pg_cron`, см. «Автоматическая граница дня» |
| `doc/db_triggers.sql` / `on_scan_insert`, `on_children_today_change`, `on_scan_insert_batch` (тикет 122) | `ON CONFLICT`-цель переходит с `(child_id)`/`(group_id)` на `(child_id, date)`/`(group_id, date)` |
| `useBusData.js`/`useGroups.js`/`useChildPresence.js` (и другие читатели `children_today`/`groups_today`) | все существующие запросы получают явный фильтр `date = сегодня` |
| `MainView.vue` | кнопки "Busse" (:75-88) и "Admin Übersicht" (:91-105) — на пересмотр, см. «UI изменения» |
| `router/index.js` | новые маршруты для списка/детальных экранов контрольных точек; `/admin-busses`/`/children` — на пересмотр |

# Изменения существующих компонентов

Ничего из этого не применяется в 130 — раздел описывает конкретные правки
для тикета реализации.

- **`AdminBusView.vue`** — полностью заменяется (см. «UI изменения»,
  экран "Checkpoints"). Общая сводка Kinder/Betreuer (:17-56) переезжает на
  новый главный экран как есть — она уже type-агностична (агрегирует
  `children_today`/`user_group_day`, не завязана на автобусы конкретно).
- **`ChildrenView.vue`** — таблица групп/статус-логика (:75-206) и
  предупреждение о недостающих детях (:67-70) переносятся в Group
  Checkpoint detail практически без изменений — это ровно то, что просит
  `130.txt` в разделе "Отображение результатов"/п.2. Судьба самого
  маршрута `/children` как отдельного пункта меню — решение ниже.
- **`useDays.js`** — новые вызовы `startNewDay`/`softReset` из
  `AdminBusView.vue` пропадают вместе с самим экраном; функции остаются в
  файле, но не удаляются в 130 (удаление мёртвого кода — не входит в
  архитектурный тикет; технически ничего не сломается, если их просто
  перестать вызывать).
- **`useBusData.js` / `useScanPackets.js`** — `fetchPacketsForBus`/
  `fetchPacketsForGroup` дополняются опциональным параметром
  `checkpointId` (при передаче — фильтр `.eq('checkpoint_id',
  checkpointId)` вместо/вместе с фильтром по `date`), чтобы детальный
  экран открытой контрольной точки показывал пакеты именно этого раунда, а
  не все пакеты за день (см. «Изменения БД» — без `checkpoint_id` две
  Bus-контрольные точки в один день технически неразличимы по данным).

# Новые компоненты

- **`CheckpointListView.vue`** (замена главного экрана `AdminBusView.vue`)
  — сводка (Kinder/Betreuer, переиспользуется из :17-56), кнопка "Создать
  контрольную точку" (открывает выбор типа — опциональный, явный путь;
  чаще точки создаются сами по первому пакету, см. «Изменения БД»), список
  контрольных точек за день, включая одновременно открытые разных типов
  (тот же список — история, см. «UI изменения»).
- **`CheckpointCreateModal.vue` / `CheckpointTypeSelect`** — выбор типа
  (Bus/Group/Lazy) при явном создании.
- **`CheckpointBusView.vue`** — детальный просмотр/мониторинг Bus
  Checkpoint: таблица автобусов (переиспользует раскладку
  `AdminBusView.vue:102-186`), список полученных пакетов на раунд
  (`BusDetailModal.vue:105-125` логика, но с фильтром `checkpoint_id`),
  кнопка **Finish** (только явная — авто-завершения нет).
- **`CheckpointGroupView.vue`** — детальный просмотр/мониторинг Group
  Checkpoint: таблица групп (переиспользует `ChildrenView.vue:75-135`),
  сворачиваемые "чистые" группы (новая UI-логика, ранее не было), список
  недостающих детей на группу (используется существующий `useGroups.
  fetchGroupDetails()`, который уже возвращает список детей с
  `presenceNow`/`presenceToday`), кнопка Finish (аналогично Bus).
- **`CheckpointLazyView.vue`** — новый экран: кто отметился/кто нет, время
  последней отметки (новый composable, см. ниже), явный Finish — без
  какого-либо авто-завершения (правило `130.txt:240` "авто-завершение
  Lazy при старте Bus/Group" отменено гибридной моделью, см. `decision.md`
  и «Риски»: типы полностью независимы, Lazy не исключение).
- **`useCheckpoints.js`** (composable) — `createCheckpoint(type)`,
  `finishCheckpoint(id)`, `cancelCheckpoint(id)`, `fetchCheckpointsForDay(day)`,
  `fetchCheckpointDetail(id)` (type-специфичный джойн со `scan_packets`/
  `children_today`), realtime-подписка на таблицу `checkpoints` (тот же
  паттерн `supabase.channel(...).on('postgres_changes', ...)`, что уже
  используют `AdminBusView.vue:480-534`, `stores/config.js:130-136`,
  `useGroups.js:219-241`).
- **`useLazyCheckpointProgress.js`** (composable, только для Lazy) —
  "кто отметился" = дети, у которых есть `scans`/`scan_packets` с этим
  `checkpoint_id`; "кто ещё нет" = разница с полным ростером группы; "время
  последней отметки" = `MAX(scan_packets.received_at)` по этому
  `checkpoint_id`.

# Изменения БД

**Не применяются в рамках 130.** Ниже — спецификация для тикета
реализации (аналогично тому, как `tickets/121/IMPLEMENTATION_PLAN.md`
специфицировал `scan_packets` до его фактического создания в 122).

## Новая таблица `checkpoints`

Решение "новая таблица" уже принято (`130.txt:93`) — вариант адаптации
`reset_events`/`admin_logs` отклонён (обоснование выше, в «Анализ текущей
архитектуры»). Модель ниже — гибридная модель из `tickets/130/decision.md`,
заменяющая более ранний вариант "не более одной открытой контрольной точки
в день независимо от типа" (см. историю решения в `decision.md`).

```sql
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  type smallint NOT NULL,            -- 1=BUS, 2=GROUP, 3=LAZY — симметрично scan_packets.type
  day character varying NOT NULL,    -- тот же формат, что day/date везде в проекте
  status smallint NOT NULL DEFAULT 1, -- 1=OPEN, 2=FINISHED, 3=CANCELLED
  created_by bigint NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  finished_by bigint NULL REFERENCES public.users(id),
  cancelled_at timestamptz NULL,
  cancelled_by bigint NULL REFERENCES public.users(id),
  baseline_children_count integer NULL, -- заполняется finish_checkpoint() только для первой завершённой контрольной точки дня
  CONSTRAINT checkpoints_pkey PRIMARY KEY (id),
  CONSTRAINT checkpoints_type_check CHECK (type IN (1, 2, 3)),
  CONSTRAINT checkpoints_status_check CHECK (status IN (1, 2, 3))
);

-- Не более одной ОТКРЫТОЙ контрольной точки НА ТИП в день — типы независимы
-- и могут идти параллельно (decision.md, п.3-4): одновременно открыты BUS
-- и GROUP — нормальное состояние; конфликт возможен только между двумя
-- контрольными точками ОДНОГО типа.
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkpoints_one_open_per_type_per_day
  ON public.checkpoints(day, type) WHERE status = 1;
```

`created_by` — не всегда администратор: контрольная точка может быть
создана автоматически при получении первого пакета (см. правило приёма
`submit_scan_packet()` ниже) — в этом случае `created_by` = автор
триггерящего пакета (`scan_packets.author_id`, воспитатель), а не admin.
Экран истории должен отличать "создана автоматически (Betreuer X)" от
"создана администратором" — см. «Риски».

Порядковый номер ("порядковый номер, тип, время создания, статус" —
`130.txt:133`) — не отдельное поле, а вычисляемое
`ROW_NUMBER() OVER (PARTITION BY day ORDER BY id)` на чтении (не хранить
избыточно, номер зависит только от `day`+`id`).

## Расширение `scan_packets`

```sql
ALTER TABLE public.scan_packets
  ADD COLUMN IF NOT EXISTS checkpoint_id bigint NULL REFERENCES public.checkpoints(id);
```

Нужно, чтобы детальный просмотр конкретной контрольной точки показывал
пакеты именно этого раунда, а не "все пакеты этого типа за день" — без
этого поля вторая Bus-контрольная точка в тот же день была бы неотличима
от первой (`useScanPackets.fetchPacketsForBus()` сегодня фильтрует только
по `bus_id`+`date`, :26-33). Заполняется внутри `submit_scan_packet()` —
либо найденной открытой контрольной точкой, либо только что автоматически
созданной (см. ниже). Клиентский `useScanPacket.js` (тикет 120) не
меняется и не знает о `checkpoint_id`.

## `submit_scan_packet()` — правило приёма (заменяет `130.txt:110-121`,
решение по гибридной модели — `tickets/130/decision.md`, п.1 и п.5)

**Пакет никогда не отклоняется из-за отсутствующей контрольной точки** —
это центральное отличие принятой модели от более раннего варианта
(`decision.md`: "воспитатели никогда не блокируются ожиданием действий
главного администратора"). Вместо поиска-с-ошибкой — атомарное
"найти открытую или создать":

```sql
-- в начале submit_scan_packet(), после разбора payload
-- 1. Создать контрольную точку, если открытой того же типа/дня ещё нет.
--    ON CONFLICT ссылается на тот же частичный индекс, что и уникальность
--    "одна открытая на тип в день" (idx_checkpoints_one_open_per_type_per_day) —
--    при гонке двух воспитателей, приславших первый BUS-пакет одновременно,
--    один INSERT выигрывает, второй молча ничего не делает:
INSERT INTO checkpoints (type, day, status, created_by)
VALUES ((payload->>'type_code')::smallint, payload->>'date', 1,
        (payload->>'author_id')::bigint)
ON CONFLICT (day, type) WHERE status = 1 DO NOTHING;

-- 2. Прочитать открытую контрольную точку этого типа/дня — гарантированно
--    находится (создана только что либо уже существовала). ORDER BY id DESC —
--    защита на случай аварийного состояния "две открытые одного типа"
--    (decision.md, п.6: "входящие пакеты относятся к последней открытой"),
--    которое в норме недостижимо благодаря уникальному индексу, но
--    теоретически возможно после ручного вмешательства в БД:
SELECT id INTO v_checkpoint_id
FROM checkpoints
WHERE day = payload->>'date'
  AND type = (payload->>'type_code')::smallint
  AND status = 1
ORDER BY id DESC
LIMIT 1;
```

Нет `RAISE EXCEPTION` в этом месте вообще — единственные ошибки
`submit_scan_packet()`, которые видит воспитатель, остаются те, что были
до 130 (валидация payload и т.п.), правило приёма контрольных точек не
добавляет новых отказов. `v_checkpoint_id` передаётся в INSERT
`scan_packets.checkpoint_id` (опционально дальше в `scans` при
необходимости трассировки).

## `create_checkpoint(p_type, p_day)` — RPC-функция

В отличие от `submit_scan_packet()` (нужен `service_role`, так как вызывает
рядовой Betreuer через недоверенный клиент), создание/завершение/отмену
контрольной точки делает администратор через уже аутентифицированную
admin-сессию — можно вызывать напрямую через `supabase.rpc()` обычным
клиентом, без Edge Function, при условии корректной RLS/функция с
`SECURITY DEFINER` и явной проверкой роли внутри.

Это **явный, отдельный от авто-создания** путь — используется, когда
администратор хочет начать раунд заранее, до первого пакета. Семантика
конфликта отличается от авто-создания в `submit_scan_packet()` намеренно
(`decision.md`, п.4: "создание второй открытой контрольной точки того же
типа через интерфейс администратора запрещается"):

```sql
-- Псевдокод, не для прямого применения:
-- 1. Если уже есть открытая checkpoint такого же (p_type, p_day) —
--    RAISE EXCEPTION ("уже идёт контрольная точка этого типа, сначала
--    завершите её") — единственный случай, где создание вообще
--    отклоняется; в отличие от submit_scan_packet(), здесь НЕ переиспользуем
--    существующую открытую молча, а форсируем явный Finish сначала —
--    иначе кнопка "создать" в UI перестала бы что-либо значить.
-- 2. INSERT INTO checkpoints (...) VALUES (p_type, p_day, 1, admin_user_id)
```

Переклички разных типов между собой никогда не конфликтуют
(`decision.md`, п.3) — авто-завершение "чужого" типа при старте другого
(`130.txt:240`, ранее — правило для Lazy) этой моделью отменяется, см.
явную пометку в «Риски» и «UI изменения» (Lazy Checkpoint).

Закрытие "хвостов", переживших полночь, отдельным шагом здесь не нужно:
уникальный индекс `idx_checkpoints_one_open_per_type_per_day` уже
day-scoped (индексный ключ включает `day`), поэтому просроченная открытая
контрольная точка вчерашнего дня физически не может конфликтовать с
сегодняшней — создание сегодняшней не блокируется и без явной очистки.
Единственный эффект "зависшей" вчерашней записи — чисто косметический
(в истории она навсегда останется в статусе OPEN); специально
автоматизировать её закрытие не требуется — экран истории может просто
визуально отмечать `day < today() AND status = OPEN` как "просрочена",
без мутации данных.

## `finish_checkpoint(p_id)` — RPC-функция

Единственный способ закрыть контрольную точку — явное действие
администратора (`decision.md`, п.2: "перекличка завершается только
главным администратором"); авто-завершения не существует ни для одного
типа, включая Lazy (см. «Риски»). Переносит логику первой ветки
`on_reset_event_insert` `event_type=1` (`doc/db_triggers.sql:150-157`) с
события "первый reset_events за день" на событие "первая ЗАВЕРШЁННАЯ
контрольная точка за день":

```sql
-- Псевдокод:
-- 1. UPDATE checkpoints SET status=2, finished_at=now(), finished_by=... WHERE id=p_id AND status=1
-- 2. Если это первая checkpoint со status=2 за этот day (не считая p_id,
--    независимо от типа — Bus и Group конкурируют за "первая за день"
--    наравне):
--      UPDATE groups_today SET children_today = children_now WHERE date = p_day;
--      -- благодаря колонке date (см. «Автоматическая граница дня» ниже)
--      -- это ровно строки текущего дня — обновление не может задеть
--      -- строки других дней.
--      баланс "presence_morning" уже проставляется on_scan_insert_batch
--      (doc/db/scan_packets.sql:100-105) при первом скане ребёнка -
--      отдельно трогать не нужно.
--    Иначе: ничего дополнительно не сбрасывать (см. следующий пункт).
```

**Важное отличие от старой модели**: старый "Soft Reset" безусловно обнулял
`children_now`/`presence_now` **для всех детей всех групп** при каждом
нажатии — это имело смысл для одной общей перекличке за раз, но не
переносится дословно на "контрольная точка = раунд конкретного типа/
объёма". Обнуление `_now`-счётчиков при `finish_checkpoint()` **не
предусмотрено** — рекомендация: каждый раунд различается через
`scan_packets.checkpoint_id`/`scans.packet_id`, а не через мутацию общих
`_now`-полей; единственный сброс счётчиков — автоматический в начале
нового дня (см. ниже). Это прямо соответствует замыслу `130.txt:206` ("не
нужно его начинать/заканчивать, происходит автоматом") и упрощает модель —
Finish становится чисто фиксацией итога, а не побочным сбросом чужих
данных.

## `cancel_checkpoint(p_id)` — RPC-функция

`UPDATE checkpoints SET status=3, cancelled_at=now(), cancelled_by=...
WHERE id=p_id AND status=1`. Пакеты, уже принятые в рамках отменённой
контрольной точки (`scan_packets.checkpoint_id = p_id`), сознательно не
откатываются — `scan_packets`/`scans` не имеют механизма отмены даже
сегодня (`scan_packets.cancelled_at` зарезервирован, но не используется,
`doc/db/scan_packets.sql:39`). Это открытый вопрос для тикета реализации,
не для 130 — фиксируется явно, не решается.

## Автоматическая граница дня (замена Hard/Soft/Total Reset)

Согласно `130.txt:206`: день начинается/заканчивается автоматически по
календарной дате, без кнопок и без фонового планировщика. Решение
пересмотрено по итогам обсуждения 130 — вариант с `pg_cron`-джобой
(`daily_rollover()`, `DELETE FROM children_today/groups_today` по
расписанию) отклонён; вместо него `children_today`/`groups_today`
получают колонку `date` и переходят на ту же модель, что уже используют
`scans`/`checkpoints` — "одна строка на сущность **и** день", а не "одна
строка на сущность навсегда, обнуляемая по требованию". Это заодно
устраняет и сам источник дискомфорта, из-за которого встал вопрос: обе
таблицы сегодня — единственное место в схеме, где строка не растёт
по истории, а переиспользуется/удаляется, что для реляционной модели
нетипично.

### Схема

```sql
ALTER TABLE public.children_today
  ADD COLUMN IF NOT EXISTS date character varying NOT NULL
    DEFAULT to_char(now(), 'YYYY-MM-DD');
ALTER TABLE public.children_today DROP CONSTRAINT children_today_child_id_key;
ALTER TABLE public.children_today
  ADD CONSTRAINT children_today_child_id_date_key UNIQUE (child_id, date);

ALTER TABLE public.groups_today
  ADD COLUMN IF NOT EXISTS date character varying NOT NULL
    DEFAULT to_char(now(), 'YYYY-MM-DD');
ALTER TABLE public.groups_today DROP CONSTRAINT groups_today_group_id_key;
ALTER TABLE public.groups_today
  ADD CONSTRAINT groups_today_group_id_date_key UNIQUE (group_id, date);
ALTER TABLE public.groups_today DROP CONSTRAINT groups_today_user_id_key;
ALTER TABLE public.groups_today
  ADD CONSTRAINT groups_today_user_id_date_key UNIQUE (user_id, date);
```

`date` — тот же текстовый формат `YYYY-MM-DD`, что уже используют
`scans.date`/`checkpoints.day` (продолжение существующей конвенции схемы,
а не новая). `groups_today_user_id_key` тоже переводится на
`(user_id, date)`, а не остаётся глобальным — иначе первая же строка
следующего дня для того же Betreuer нарушила бы старый `unique(user_id)`.

### Почему это снимает зависимость от `pg_cron` целиком

- **Переход дня перестаёт быть действием.** Строка за вчера просто не
  совпадает с `WHERE date = сегодня` ни в одном запросе — ни `DELETE`,
  ни явное "открыть день" не нужны ни для `children_today`, ни для
  `groups_today`. Строка нового дня создаётся сама — первым `INSERT ...
  ON CONFLICT (child_id, date) DO UPDATE` в `on_scan_insert`/
  `on_scan_insert_batch` (`ON CONFLICT`-цель меняется с `(child_id)` на
  `(child_id, date)`, аналогично `on_children_today_change` →
  `groups_today`).
- **Сброс `_now`-счётчиков в начале дня тоже становится не нужен
  отдельно.** Строка вчерашнего дня никуда не девается, но к ней никто
  не обращается — строка сегодняшнего дня просто ещё не существует до
  первого скана и стартует с `presence_now=0`/`children_now=0` по
  умолчанию колонки. Раньше это явно делал `event_type=0` — теперь это
  прямое следствие схемы, а не отдельный шаг.
- **Единственный оставшийся "хвост" — открытая контрольная точка,
  пережившая полночь** (типично Lazy, но правило общее для любого типа) —
  и для неё планировщик не нужен по той же причине, по которой не нужна и
  специальная очистка: `idx_checkpoints_one_open_per_type_per_day`
  индексирует по `(day, type)`, так что вчерашняя зависшая `OPEN`-запись
  никогда не конфликтует с сегодняшней (см. «`create_checkpoint()`» —
  никакого шага очистки не требуется вообще, это чисто косметический
  вопрос отображения истории, не блокировки).

### Цена решения

Все существующие чтения `children_today`/`groups_today`
(`useBusData.fetchBusData()`, `useGroups.fetchGroupsData()`,
`useChildPresence`, прочие SELECT'ы) должны получить явный фильтр
`date = сегодня` — это более широкая по охвату миграция, чем просто
убрать кнопки Hard/Soft Reset, так как трогает существующие read-пути, а
не только запись (см. «Затрагиваемые модули», «Риски»). Рост таблиц при
этом не проблема: при масштабе проекта (несколько сотен детей × активные
дни мероприятия за сезон) это десятки тысяч строк за годы — без
партиций/архивации.

`pg_cron` этой части архитектуры **не требуется вообще** — зависимость от
него снята из плана полностью.

## `reset_events` и связанные объекты

Не удаляются в 130 (не входит в архитектурный тикет), но по факту
принятого решения (`130.txt:206`, "существующие tag starten/hard reset и
soft reset упраздняются") становятся мёртвым кодом вместе с: триггером
`on_reset_event_insert`, `useDays.startNewDay/softReset/closeDay/
isDayStarted/isDayClosed`, `ResetHistoryPanel.vue`,
`useBusData.getResetHistory()`. Удаление — явный шаг тикета реализации, не
подразумеваемое побочное действие.

## RLS для `checkpoints`

Следуя общему паттерну admin-only таблиц проекта (`days`/`config`, см.
`vault/03-База-данных/RLS-политики.md`): `SELECT` — любой `authenticated`
(воспитатели должны видеть, идёт ли сейчас контрольная точка их типа);
`INSERT`/`UPDATE` — **только через `SECURITY DEFINER`-функции**, но теперь
таких точек входа для `INSERT` две, а не одна:
- `submit_scan_packet()` (`service_role`, недоверенный вызывающий —
  воспитатель) — авто-создание по первому пакету;
- `create_checkpoint()`/`finish_checkpoint()`/`cancel_checkpoint()`
  (обычная admin-сессия) — явное управление.

Обе — `SECURITY DEFINER` с проверкой внутри, **без** прямой permissive-
политики "authenticated может писать" — именно эта ошибка (старые широкие
политики поверх узких) задокументирована как реальная дыра для
`reset_events`/`children_today`/`groups_today` (`vault/03-База-данных/
RLS-политики.md`, "Неотозванные широкие legacy-политики"). Требование явно
фиксируется здесь, чтобы не повторить его для новой таблицы.

# API изменения

Изменения только концептуальные (сигнатуры/контракты), не применяются.

| Функция/вызов | Тип | Кто вызывает | Назначение |
|---|---|---|---|
| `submit_scan_packet(payload)` | существующая Postgres-функция, расширяется | Edge Function `submit-scan-packet` (`service_role`), без изменений на клиенте | пакет принимается всегда; недостающая контрольная точка соответствующего типа создаётся автоматически (`INSERT ... ON CONFLICT DO NOTHING` + чтение), запись `checkpoint_id` |
| `create_checkpoint(type, day)` | новая Postgres RPC-функция | `useCheckpoints.js` напрямую через `supabase.rpc()`, admin-сессия | явное создание раунда заранее; отклоняется, если того же типа уже открыт (админ должен сначала Finish) |
| `finish_checkpoint(id)` | новая Postgres RPC-функция | `useCheckpoints.js`, admin-сессия | завершение + baseline-снимок при первом за день (независимо от типа) |
| `cancel_checkpoint(id)` | новая Postgres RPC-функция | `useCheckpoints.js`, admin-сессия | отмена |
| `fetchCheckpointsForDay(day)` | новая функция в `useCheckpoints.js` | UI списка/истории | обычный SELECT с RLS, без RPC |
| `fetchPacketsForBus(busNumber, date, checkpointId?)` / `fetchPacketsForGroup(...)` | расширение существующих (`useScanPackets.js:26-64`) | `CheckpointBusView.vue`/`CheckpointGroupView.vue` | фильтр по конкретному раунду |

Ни один новый вызов не требует новой Edge Function — вся администраторская
логика идёт через обычный аутентифицированный клиент + `SECURITY DEFINER`
RPC (в отличие от `submit_scan_packet()`, которому нужен `service_role`
из-за недоверенного вызывающего — воспитателя). Единственное расширение
ответственности недоверенного пути — сам факт авто-создания записи в
`checkpoints` внутри `submit_scan_packet()`, см. «Риски».

# UI изменения

Не применяются, концептуальное описание экранов и переходов.

## Главный экран — `CheckpointListView.vue` (заменяет `/admin-busses`)

```
┌─────────────────────────────────────┐
│  Gesamt: 42 Kinder / 8 Betreuer      │   ← переезжает из AdminBusView:17-56
├─────────────────────────────────────┤
│  [ + Neuen Checkpoint erstellen ]    │   ← опционально: явное создание, выбор типа
├─────────────────────────────────────┤
│  Checkpoints (heute)                 │
│  #1  Bus    09:05  FINISHED  ✓       │
│  #2  Bus    09:20  OPEN      ●       │   ← новый Bus-раунд, начат авто по первому пакету
│  #3  Group  09:15  OPEN      ●       │   ← ОДНОВРЕМЕННО открыт с #2 — нормальное состояние (decision.md, п.3)
│  #4  Lazy   13:00  OPEN      ●       │   ← клик открывает detail/monitor
└─────────────────────────────────────┘
```

Ключевое визуальное отличие от более раннего варианта: **несколько
открытых строк одновременно, разных типов, — не ошибка и не подсвечивается
как конфликт** (`decision.md`, п.3). Конфликт возможен только между двумя
открытыми точками ОДНОГО типа — такое состояние UI не должен допускать
создавать (см. `create_checkpoint()`), а если оно всё же возникло
("аварийная ситуация", `decision.md` п.6), список должен явно выделять его
как аномалию, а не просто показывать две строки OPEN подряд.

Список — одновременно точка создания и история (`130.txt:132-138,
247-254`) — один компонент, не два экрана. Realtime вместо кнопки
"Aktualisieren" (переиспользуется паттерн `AdminBusView.vue:480-534`).
Строки, созданные автоматически (по первому пакету, а не кнопкой), должны
быть отличимы в списке (например, "создана автоматически (Betreuer X)") —
см. «Риски».

## Детальный экран Bus Checkpoint (`CheckpointBusView.vue`)

Раскладка = таблица автобусов `AdminBusView.vue:102-186` (статус-точка,
Kinder/Betreuer/Verantwortliche) + список полученных пакетов на этот
раунд (`BusDetailModal.vue:105-125`, но без модалки — отдельный экран, так
как это теперь основной рабочий экран, а не второстепенная деталь) +
кнопка **Finish** (единственный способ закрыть раунд, `decision.md` п.2) /
**Cancel** (`130.txt:193-210`).

## Детальный экран Group Checkpoint (`CheckpointGroupView.vue`)

Раскладка = таблица групп `ChildrenView.vue:75-135` (status-dot,
Morgen/Aktuell/Betreuer/Differenz) с добавлением сворачивания групп без
проблем (`130.txt:225-227` — новая UI-логика, ранее не было). Список
недостающих детей по клику на проблемную группу — данные уже есть в
`useGroups.fetchGroupDetails()` (:92-175, возвращает детей с
`presenceNow`/`presenceToday`). Finish/Cancel — аналогично Bus.

## Детальный экран Lazy Checkpoint (`CheckpointLazyView.vue`)

Новый экран: три списка/счётчика — "отметились" / "ещё нет" / "время
последней отметки" (`130.txt:153-156`). **Finish — только явная кнопка
admin**, без какого-либо авто-завершения. Правило `130.txt:240`
("авто-завершение Lazy при старте следующей Bus/Group") этим документом
**отменено** по итогам `decision.md` — гибридная модель делает все три
типа симметричными: ни один тип не влияет на состояние другого, единственный
способ закрыть любую контрольную точку, включая Lazy, — явный Finish.

## Пересмотр меню администратора (`130.txt:256-265`, входит в DoD 130)

Рекомендация (не окончательное решение — подтверждается на старте тикета
реализации):

- **`MainView.vue` "Busse" (:75-88) и "Admin Übersicht" (:91-105)** —
  объединяются в одну кнопку "Checkpoints"/"Контрольные точки", ведущую на
  `CheckpointListView.vue`. Обе сегодняшние цели (`/admin-busses`,
  `/children`) прекращают существовать как отдельные пункты меню — их
  функциональность полностью покрывается новым экраном + детальными
  экранами по типу.
- **"Tag starten"/"Soft Reset"/"Aktualisieren"** — удаляются полностью
  (см. «Изменения БД», автоматическая граница дня).
- **"Bus Alerts"** (предупреждение `ChildrenView.vue:67-70`) — переезжает
  в Group Checkpoint detail как есть (`130.txt:148-151`, "есть ли
  отсутствующие, список недостающих детей").
- **Маршруты**: `/admin-busses` и `/children` — удаляются вместе с
  компонентами; новые — например `/admin/checkpoints` (список),
  `/admin/checkpoints/:id` (детальный экран, type-диспетчеризация внутри
  по `checkpoints.type`). Точные пути — на усмотрение реализации.

# План реализации

Порядок для будущего тикета реализации (не выполняется в 130):

1. Миграция БД: таблица `checkpoints`, колонка `scan_packets.checkpoint_id`,
   функции `create_checkpoint`/`finish_checkpoint`/`cancel_checkpoint`,
   расширение `submit_scan_packet()` (авто-создание/поиск, без отказов),
   RLS-политики (узкие, без legacy-риска).
2. Миграция `children_today`/`groups_today` на date-scoped схему: колонка
   `date`, замена unique-констрейнтов на `(child_id, date)`/
   `(group_id, date)`/`(user_id, date)`, обновление `ON CONFLICT`-целей в
   `on_scan_insert`/`on_children_today_change`/`on_scan_insert_batch`,
   добавление фильтра `date = сегодня` во все существующие чтения
   (`useBusData.js`/`useGroups.js`/`useChildPresence.js` и т.д.) — заменяет
   `daily_rollover()`/`pg_cron`, см. «Автоматическая граница дня».
3. `useCheckpoints.js` + `useLazyCheckpointProgress.js`.
4. `CheckpointListView.vue` + опциональное явное создание (тип-селектор).
5. `CheckpointBusView.vue` (наименьший риск — почти прямой перенос
   существующей раскладки `AdminBusView.vue`/`BusDetailModal.vue`).
6. `CheckpointGroupView.vue` (перенос `ChildrenView.vue` + сворачивание групп).
7. `CheckpointLazyView.vue` (полностью новый экран; Finish — только явная
   кнопка admin, без авто-завершения, см. «Риски»).
8. Обновление `router/index.js`, `MainView.vue` (объединение кнопок).
9. Удаление мёртвого кода: `AdminBusView.vue`, `ChildrenView.vue`,
   `ResetHistoryPanel.vue`, `BusDetailModal.vue`/`GroupDetailModal.vue`
   (если полностью замещены, а не переиспользованы как есть),
   `useDays.startNewDay/softReset/closeDay/isDayStarted/isDayClosed`,
   `useBusData.getResetHistory`, `reset_events`-триггер (после подтверждения,
   что таблица больше нигде не читается).
10. Ручная проверка на устройстве (по аналогии с 120/122/123/126 — этот
    проект пока не имеет инструмента браузерной автоматизации в сессии).

# Риски

- **Расширение ответственности недоверенной функции**: `submit_scan_packet()`
  теперь не только принимает данные, но и может создать административную
  запись (`checkpoints`) — раньше эта граница ("недоверенный путь только
  принимает/отклоняет, вся управляющая логика — на доверенном admin-пути")
  была чёткой, гибридная модель (`decision.md`) её слегка размывает.
  Смягчается тем, что сама операция создания тривиальна и безопасна
  (`INSERT ... ON CONFLICT DO NOTHING`, ограничена уникальным индексом,
  не может создать дублирующее состояние и не имеет побочных эффектов
  за пределами своей строки) — то есть расширение ответственности
  контролируемое, а не открытое.
- **`created_by` контрольной точки не всегда администратор** — при
  авто-создании это автор триггерящего пакета (воспитатель). Экран
  истории/список (`CheckpointListView.vue`) должен явно отличать "создана
  автоматически (Betreuer X)" от "создана администратором явно" — иначе
  список будет вводить в заблуждение ("кто и почему начал этот раунд").
- **Параллельные открытые контрольные точки разных типов — новое поведение,
  которого не было в более раннем варианте плана**: UI (список, детальные
  экраны) должен явно показывать это как нормальный режим работы, не как
  ошибку/рассинхронизацию (`decision.md`, п.3). Тестировать нужно именно
  сценарий "Bus ещё открыт, Group уже открыт" как штатный, а не граничный
  случай.
- **Отмена (`cancel_checkpoint`) не откатывает уже принятые пакеты** —
  `scan_packets`/`scans` не имеют механизма отмены (зарезервированное
  `cancelled_at` не используется, `doc/db/scan_packets.sql:39`). Если
  реализация признает это недостаточным, потребуется отдельное
  расширение вне текущего объёма 130.
- **Миграция `children_today`/`groups_today` на date-scoped схему трогает
  больше существующих read-путей, чем удаление кнопок Hard/Soft Reset**
  (`useBusData.js`/`useGroups.js`/`useChildPresence.js` и другие читатели
  должны получить фильтр `date = сегодня` — см. «Автоматическая граница
  дня»). Разовая, но более широкая миграция; риск — пропустить один из
  существующих запросов и получить смешение данных нескольких дней.
  Взамен — зависимость от `pg_cron` для этой части архитектуры снята
  полностью, а не просто отложена на случай его недоступности.
- **Смешение ответственности `finish_checkpoint()`**: функция одновременно
  "закрывает раунд" и (иногда) "фиксирует baseline дня" — два разных по
  смыслу действия в одной функции. Сделано намеренно, чтобы не вводить
  отдельную кнопку/действие "начать день" (`130.txt:206` явно этого не
  хочет), но это увеличивает связность функции — стоит держать два шага
  чётко разделёнными внутри реализации (отдельные под-запросы/шаги, не
  единая непрозрачная транзакция без комментариев).
- **RLS для `checkpoints` должна быть спроектирована аккуратно с первого
  раза** — прецедент с `reset_events`/`children_today`/`groups_today`
  (широкие legacy-политики, задокументировано в
  `vault/03-База-данных/RLS-политики.md`) показывает, что "добавить потом
  узкую политику поверх широкой" не работает (PostgreSQL объединяет
  permissive-политики через OR). Узкая admin-only модель должна быть
  единственной с самого начала, без "временных" широких политик "just in
  case" — включая оба пути `INSERT` (авто-создание и явное создание, см.
  «RLS для `checkpoints`»).
- **`GroupDetailModal.vue`/`BusDetailModal.vue` — модалка vs. отдельный
  экран**: в новом дизайне детальный просмотр контрольной точки — не
  второстепенная деталь (клик "посмотреть пакеты"), а основной рабочий
  экран (мониторинг). Прямое переиспользование этих компонентов как
  модалок, скорее всего, не подойдёт целиком — они предложены как
  источник вёрстки/логики, не для использования "as is" без изменений.

**Решённое исходное разногласие** (для истории, не требует повторного
рассмотрения): более ранний вариант плана требовал явного `create_roll_call`
для каждого раунда и отклонял пакет при отсутствии открытой переклички
(`RAISE EXCEPTION`), что порождало риск "воспитатели заблокированы, если
администратор забыл нажать кнопку" и открытый вопрос "авто-завершать или
блокировать конфликт Bus/Bus". `tickets/130/decision.md` заменяет это
гибридной моделью (авто-создание по пакету + explicit-only Finish +
независимые типы) — оба эти риска сняты design-ом, а не оставлены как
открытые вопросы для тикета реализации.

# Definition of Done

- Спецификация таблицы `checkpoints` (поля, constraints, unique-индекс "не
  более одной открытой контрольной точки на тип в день") зафиксирована
  выше.
- Правило приёма `scan_packets` описано: пакет принимается всегда;
  недостающая контрольная точка соответствующего типа/дня создаётся
  автоматически (`INSERT ... ON CONFLICT DO NOTHING` + чтение); точка
  внедрения в `submit_scan_packet()` зафиксирована выше.
- `create_checkpoint`/`finish_checkpoint`/`cancel_checkpoint` специфицированы:
  явное создание отклоняется при уже открытой точке того же типа (форсирует
  Finish), Finish — единственный способ закрыть раунд (без авто-завершения
  для любого типа, включая Lazy), Cancel не откатывает пакеты (зафиксировано
  как ограничение).
- Механизм замены Hard/Soft/Total Reset на автоматическую границу дня +
  baseline-снимок при первой завершённой контрольной точке дня описан:
  `children_today`/`groups_today` переходят на date-scoped схему (колонка
  `date`, unique `(entity_id, date)`) без зависимости от `pg_cron`.
- Все три детальных экрана (Bus/Group/Lazy) специфицированы с указанием,
  какие существующие компоненты/composables служат основой, и с учётом
  того, что несколько контрольных точек разных типов могут быть открыты
  одновременно.
- Явно предложено решение по пересмотру меню администратора (объединение
  "Busse"/"Admin Übersicht" в одну кнопку, удаление Tag starten/Soft
  Reset/Aktualisieren, перенос Bus Alerts) — помечено как рекомендация,
  подлежащая подтверждению на старте реализации, не как решённый факт.
- Открытые вопросы, явно не решённые здесь (механизм отмены пакетов,
  полнота миграции read-путей на date-scoped схему `children_today`/
  `groups_today`), перечислены в «Риски», не скрыты. Вопрос "блокировать
  или авто-завершать при конфликте Bus/Bus" из более раннего варианта
  плана — решён `decision.md` (блокировать через явный `create_checkpoint`,
  авто-создание никогда не конфликтует), повторному рассмотрению не
  подлежит.
- БД/код не изменены в рамках этого документа — только спецификация.
