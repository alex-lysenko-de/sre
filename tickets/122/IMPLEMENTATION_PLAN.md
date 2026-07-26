# Тикет 122 — План реализации: серверная логика обработки ScanPacket

Входные данные: `tickets/122/122.txt` (задача), `tickets/121/IMPLEMENTATION_PLAN.md`
(принятые архитектурные решения — вариант A, батч-триггеры, Edge Function
`submit-scan-packet`, идемпотентность по `client_packet_id`, структура без
DDL), `tickets/120/IMPLEMENTATION_PLAN.md`/`DECISIONS.md` (клиентский
контракт `PresencePacket`, разделение объёма 120/122, требование
одновременного релиза), `vault/03-База-данных/*`, `vault/07-Edge-Functions/*`.

В отличие от 121 этот документ **содержит** детальную техническую
проработку (DDL, контракт Edge Function, псевдокод триггеров) — именно
это 121 сознательно отложил сюда.

# Цель

Реализовать серверную часть тикета 120: приём, атомарное и идемпотентное
сохранение пакетов результатов сканирования (`PresencePacket`), без
разрушения существующей корректности `children_today`/`groups_today`, и
без N-кратного каскада триггеров на пакет. Переработать
`AdminBusView.vue` (и точечно — другие экраны администратора) под новый,
пакетно-ориентированный источник данных «кто/когда/что прислал».

Реализуется **одновременно** с тикетом 120 в рамках одного релиза
(`122.txt`, `120.txt`) — рассинхронизация контракта `PresencePacket`
между клиентом (120) и сервером (122) является общим риском обоих
тикетов, не только этого.

# Анализ текущей архитектуры

- **`scans`** — append-only, `id, created_at, date, user_id, child_id,
  band_id, bus_id, type`. Пишут сегодня: `useArmband.recordChildPresence()`
  (удаляется тикетом 120) и `useScan.createScan()` (**не удаляется** ни
  120, ни этим тикетом — единственный оставшийся прямой писатель, см.
  «Риски», пункт про недостигнутый инвариант «только через пакет»).
- **Триггеры** (`vault/03-База-данных/Триггеры.md`): `on_scan_insert`
  (`AFTER INSERT ON scans FOR EACH ROW`) — upsert `children_today` через
  `INSERT ... ON CONFLICT (child_id) DO UPDATE`, с сознательным
  исключением `presence_morning` из `SET`-списка (тикет 106, разовый
  снимок). `on_children_today_change` (`AFTER INSERT OR UPDATE ON
  children_today FOR EACH ROW`) — полный `COUNT(*) FILTER` пересчёт
  `groups_today` для затронутой группы. Оба построчные — источник
  проблемы N-кратных каскадов (`tickets/121/IMPLEMENTATION_PLAN.md`,
  раздел 6).
- **`children_today`/`groups_today`** — upsert/агрегатные таблицы,
  читаются `HeadcountView.vue` (Kopfzählung, тикет 106), `ChildrenView.vue`
  (`useGroups.fetchGroupsData()`), `useBusData.fetchBusData()`
  (`AdminBusView.vue`). Ни одна из этих трёх read-моделей не завязана на
  структуру `scans` напрямую — только на `children_today`/`groups_today`,
  которые триггеры продолжат наполнять корректно (раздел 6 121-го плана).
  Значит: **`HeadcountView.vue`, `ChildrenView.vue`, `useGroups.js` не
  меняются** этим тикетом.
- **`AdminBusView.vue`** — держит Realtime-подписку (`postgres_changes`)
  на `children_today` (весь стрим), `user_group_day` (по `day`),
  `reset_events` (`INSERT`, по `day`); `useBusData.fetchBusData()`
  агрегирует «сколько детей сейчас в автобусе N» (`children_today.bus_now
  + presence_now`) и «сколько Betreuer назначено на автобус N сегодня»
  (`user_group_day`). Эта агрегация продолжит работать после 122 без
  изменений — она не читает `scans` вовсе. Чего в `AdminBusView.vue`
  сегодня нет и что нужно добавить — представление «кто прислал пакет,
  когда, сколько детей, отменён ли» (`122.txt`, раздел «UI главного
  администратора»).
- **Edge Functions** (`vault/07-Edge-Functions/Обзор-Edge-Functions.md`):
  единственный существующий прецедент бизнес-логики — `delete-user` —
  создаёт клиент на `SUPABASE_ANON_KEY` для проверки
  `Authorization`-токена (`auth.getUser(token)`), затем отдельный клиент
  на `SUPABASE_SERVICE_ROLE_KEY` для проверки роли в `public.users` и
  привилегированной операции. `submit-scan-packet` следует тому же
  паттерну (см. «API изменения»).
- **RLS**: `scans` сегодня без задокументированной политики (ни в
  `vault/03-База-данных/RLS-политики.md`, ни в дампе схемы для неё нет
  отдельного упоминания уровня, отличного от общего) — прямой путь
  `useScan.createScan()` полагается на то, что уже действует для `scans`
  сейчас; этот тикет его не меняет. Для новых таблиц — см. «Изменения БД».
  Известная опасность в проекте: широкие legacy-политики `USING(true) TO
  authenticated`, перекрывающие узкие политики через OR-семантику
  PostgreSQL (`RLS-политики.md`, ⚠-раздел) — при написании политик для
  `scan_packets` нужно **не создавать** второй, более широкой политики
  того же действия, иначе новая узкая станет фиктивной тем же образом.

# Затрагиваемые модули

**Новые:**
- Таблица `scan_packets` (заголовок пакета).
- Функция БД `submit_scan_packet(payload jsonb)` (атомарная композитная
  вставка заголовка + дочерних строк `scans`).
- Edge Function `supabase/functions/submit-scan-packet/index.ts`.
- Composable `src/composables/useScanPackets.js` (чтение заголовков
  пакетов для admin-экранов).
- Компонент `src/components/ScanPacketList.vue` (список пакетов —
  переиспользуется в `BusDetailModal.vue` и в новом
  `GroupDetailModal.vue`).
- Компонент `src/components/GroupDetailModal.vue` (аналог
  `BusDetailModal.vue` для групп — сегодня у групп нет drill-down;
  минимально необходим, чтобы выполнить требование 122.txt «по группам»
  без изменения существующей сводной таблицы `ChildrenView.vue`).

**Изменяемые:**
- `scans` — добавляются `packet_id`, `method` (миграция, см. «Изменения БД»).
- Триггеры `on_scan_insert`, `on_children_today_change` — переводятся с
  построчных на постатементные (раздел 6 плана 121).
- `src/composables/useBusData.js` — новая функция чтения пакетов по
  автобусу (или делегирование в `useScanPackets.js`, см. «Изменения
  существующих компонентов»).
- `src/views/AdminBusView.vue` — секция «Empfangene Pakete», пересмотр
  смысла индикатора Realtime.
- `src/components/BusDetailModal.vue` — встраивается `ScanPacketList.vue`.
- `src/views/ChildrenView.vue` — точка входа (кнопка/строка) на новый
  `GroupDetailModal.vue`.

**Не затрагиваемые** (обоснование выше): `HeadcountView.vue`,
`useChildPresence.js`, `useGroups.js` (кроме, возможно, добавления
точки входа в модалку — см. UI-изменения), `useScan.js` (кроме
чтения — см. риски), `ChildDetailView.vue`, `src/composables/useArmband.js`
(меняется тикетом 120, не этим), схема `children`/`user_group_day`/`config`/
`days`/`reset_events`.

# Изменения существующих компонентов

## `src/composables/useBusData.js`

Добавить функцию `fetchBusPackets(busNumber, date)`, читающую
`scan_packets` (`type = BUS`, `bus_id = busNumber`, `date = date`),
возвращающую массив `{ id, author_name, received_at, children_count,
cancelled_at }`. Реализация может либо жить здесь, либо целиком в новом
`useScanPackets.js` с реэкспортом — решение о размещении оставлено
реализации (не архитектурная развилка: `useBusData.js` уже смешивает
`children_today`+`user_group_day`, добавление третьего источника не
нарушает существующий паттерн композabla, работающего с несколькими
таблицами).

## `src/views/AdminBusView.vue`

- `loadBusData()` дополняется параллельным вызовом чтения пакетов
  (список пакетов за сегодня, без привязки к конкретному автобусу — для
  новой секции на верхнем уровне экрана) — по образцу уже существующего
  `Promise`-независимого вызова `fetchBusData`/`isDayStarted`.
- Новая секция «Empfangene Pakete» (список последних N пакетов: автор,
  время, тип, количество детей, статус) — под существующей карточкой
  «Alle Busse», без замены существующей таблицы по автобусам (она
  продолжает показывать текущие агрегаты `children_today`/`user_group_day`,
  которые не изменились).
- Realtime-подписка **не удаляется** — `children_today`/`user_group_day`/
  `reset_events` действительно продолжают меняться (пакетно, а не по
  скану) и переподгрузка по этим событиям остаётся корректной. Только
  переименовать/переформулировать индикатор «Live» → например «Aktualisiert
  bei Paket-Empfang», чтобы не подразумевать пер-скановую живость, которой
  больше нет. Строкового текста в шаблоне достаточно; сама механика канала
  не меняется.
- `BusDetailModal.vue` при открытии дополнительно запрашивает
  `fetchBusPackets(busNumber, date)` и передаёт результат в
  `ScanPacketList.vue`.

## `src/components/BusDetailModal.vue`

Добавляется секция (после «Betreuer in diesem Bus», по аналогии с
существующим паттерном `list-group`) с `<ScanPacketList :packets="busPackets" />`.

## `src/views/ChildrenView.vue`

Добавляется точка входа (кнопка/иконка в существующей строке группы) на
новый `GroupDetailModal.vue` — по аналогии с `openBusDetail()` в
`AdminBusView.vue`. Сама сводная таблица групп (`fetchGroupsData()`) не
меняется.

# Новые компоненты

## Таблица `scan_packets`

Заголовок пакета (обоснование необходимости — `tickets/121/IMPLEMENTATION_PLAN.md`,
раздел 4).

```sql
create table public.scan_packets (
  id bigint generated by default as identity not null,
  client_packet_id uuid not null,
  type smallint not null,               -- 1=BUS, 2=GROUP, 3=CHECKIN (см. ниже)
  author_id bigint not null,
  bus_id smallint null,                 -- заполнено при type=BUS
  group_id smallint null,               -- заполнено при type=GROUP
  date character varying not null,      -- 'YYYY-MM-DD', как scans.date
  started_at timestamp with time zone not null,
  finished_at timestamp with time zone not null,
  received_at timestamp with time zone not null default now(),
  children_count smallint not null default 0,
  cancelled_at timestamp with time zone null,  -- задел под раздел 10 плана 121
  constraint scan_packets_pkey primary key (id),
  constraint scan_packets_client_packet_id_key unique (client_packet_id),
  constraint scan_packets_author_id_fkey foreign key (author_id)
    references users (id) on update cascade
);

create index idx_scan_packets_date_bus on public.scan_packets (date, bus_id);
create index idx_scan_packets_date_group on public.scan_packets (date, group_id);
create index idx_scan_packets_author_date on public.scan_packets (author_id, date);
```

`type` — smallint по существующей конвенции проекта (`scans.type`), а не
text/enum — минимизирует расхождение стиля со `scans`. Точное сопоставление
чисел (`1=BUS, 2=GROUP, 3=CHECKIN`) фиксируется здесь как единственный
источник истины для 120/122 (в `120.txt` типы названы словами, числовой
код для БД не определён — вводится этим документом).

## Изменения `scans`

```sql
alter table public.scans
  add column packet_id bigint null
    references public.scan_packets (id) on update cascade,
  add column method smallint not null default 1;  -- 1=SCAN, 2=MANUAL
```

`packet_id` **nullable** — переходный период (решение зафиксировано в
`tickets/121/IMPLEMENTATION_PLAN.md`, раздел 9); `NOT NULL` — отдельный,
более поздний шаг, не входит в 122 (см. «Риски» — этот шаг **не может**
быть безопасно выполнен, пока жив `useScan.createScan()`/
`ChildDetailView.vue`, см. ниже).

`method` — `DEFAULT 1` (SCAN), чтобы существующие строки `scans` (не
имеющие явного метода) и текущий путь `useScan.createScan()`
(`ChildDetailView.vue`, ручное переназначение автобуса — по сути тоже
`MANUAL`, но переписывать этот путь вне объёма 122) остались валидными
без немедленной правки кода, вызывающего `createScan()`.

## Батч-обработка триггеров (обязательная часть, план 121 раздел 6)

Оба триггера переводятся на `FOR EACH STATEMENT` с transition tables.
Смысл переработки (не финальный синтаксис — уточняется при реализации):

```sql
-- on_scan_insert: было FOR EACH ROW, становится FOR EACH STATEMENT
create trigger on_scan_insert_batch
  after insert on public.scans
  referencing new table as new_scans
  for each statement
  execute function on_scan_insert_batch();

-- Внутри on_scan_insert_batch(): один INSERT ... ON CONFLICT DO UPDATE
-- в children_today, построенный как SELECT DISTINCT ON (child_id) ...
-- FROM new_scans JOIN children ON ... ORDER BY child_id, created_at DESC
-- (последний скан ребёнка в пакете определяет bus_now/user_id, как и
-- раньше при повторных сканах одного ребёнка). presence_morning
-- по-прежнему пишется только в INSERT-ветке ON CONFLICT (инвариант тикета
-- 106 сохраняется).
```

```sql
-- on_children_today_change: было FOR EACH ROW, становится FOR EACH STATEMENT
create trigger on_children_today_change_batch
  after insert or update on public.children_today
  referencing new table as new_children_today
  for each statement
  execute function on_children_today_change_batch();

-- Внутри: пересчёт groups_today только для DISTINCT group_id из
-- new_children_today (а не полный COUNT по всем группам и не по разу на
-- ребёнка) — та же логика COUNT(*) FILTER, что и сегодня, просто
-- выполняемая один раз на каждую отличную затронутую группу вместо
-- одного раза на строку.
```

Условие корректности (раздел 5 плана 121): весь пакет должен вставляться
в `scans` **одним** SQL-оператором (`INSERT ... SELECT ... FROM
jsonb_to_recordset(...)` или аналог) — иначе statement-level триггер
всё равно сработает по разу на оператор, если вставка почему-то разбита
на несколько отдельных `INSERT`. Это прямое требование к реализации
`submit_scan_packet()` ниже.

## Функция БД `submit_scan_packet(payload jsonb)`

Синтезирует раздел 5 плана 121 («Edge Function») с требованием «один
составной оператор» (там же, минус варианта 2): бизнес-валидация и
проверка личности остаются в Edge Function (TypeScript, согласовано с
пользователем), а **атомарность многотабличной вставки** обеспечивается
не последовательными вызовами Supabase JS SDK (каждый — отдельная
неявная транзакция, недостаточно для «всё или ничего»), а одним вызовом
одной функции БД — вызов функции сам по себе уже одна транзакция
PL/pgSQL.

Контракт: принимает уже провалидированный и дополненный Edge Function
`jsonb` (после того, как Edge Function подставила проверенный
`author_id` — см. «API изменения», сервер не доверяет `author_id` из
тела запроса). Внутри одного вызова:

1. `INSERT INTO scan_packets (...) VALUES (...) ON CONFLICT
   (client_packet_id) DO NOTHING RETURNING id` — атомарная проверка
   идемпотентности через сам уникальный индекс (устойчиво к гонке двух
   одновременных ретраев одного и того же `client_packet_id`, в отличие
   от отдельного `SELECT`-перед-`INSERT`).
2. Если `id` не вернулся (конфликт — пакет уже существует) — `SELECT`
   существующий `id` и вернуть его вызывающему как признак «уже
   обработано» (не ошибка).
3. Если `id` вернулся — один `INSERT INTO scans (...) SELECT ... FROM
   jsonb_to_recordset(payload->'children') AS c(...)`, подставляя
   `packet_id = id` из шага 1 каждой строке. Это и есть тот единственный
   составной оператор, который вставляет весь пакет и от которого
   зависит корректность батч-триггеров выше.
4. Обновить `scan_packets.children_count` (или задать сразу как часть
   шага 1 из `jsonb_array_length`, не требуя отдельного `UPDATE`).
5. Вернуть `{ packet_id, status: 'created' | 'duplicate' }`.

Вызывается через `supabase.rpc('submit_scan_packet', { payload })` из
Edge Function, используя тот же `service_role`-клиент, что и сама Edge
Function (та же привилегия, RLS для `scan_packets`/`scans` не
задействуется на этом пути — см. RLS ниже). `SECURITY DEFINER` не
требуется: вызов уже идёт от `service_role`, который и так обходит RLS.

# Изменения БД

Сводка (детали — «Новые компоненты» выше):

1. `create table scan_packets (...)` + 3 индекса.
2. `alter table scans add column packet_id ..., add column method ...`
   (оба nullable/со значением по умолчанию — безопасно для существующих
   строк, обратная совместимость).
3. `create or replace function submit_scan_packet(payload jsonb) ...`
4. Переработка `on_scan_insert`/`on_children_today_change`:
   `FOR EACH ROW` → `FOR EACH STATEMENT` + `REFERENCING ... AS ...`
   (transition tables). **Обязательная**, не факультативная часть
   миграции (план 121, раздел 6) — без неё вариант A не принимается.
5. RLS для `scan_packets`:
   - `SELECT` — `TO authenticated USING (true)` (тот же паттерн, что и
     `days`/`children_today` сегодня — просмотр пакетов не более
     чувствителен, чем просмотр текущего присутствия).
   - `INSERT`/`UPDATE`/`DELETE` от имени обычной роли — **не
     создавать вовсе**. Единственный путь записи — `submit_scan_packet()`
     под `service_role` (через Edge Function). Отсутствие permissive-
     политики на запись для `authenticated` — осознанное отличие от
     существующей практики широких legacy-политик (`RLS-политики.md`,
     ⚠-раздел) и явное недопущение повторения той же ошибки для новой
     таблицы.
6. RLS для `scans`/`children_today`/`groups_today` — **без изменений** в
   рамках 122: пакетный путь пишет через `service_role` (обходит RLS
   независимо от политик), путь `useScan.createScan()` продолжает
   полагаться на уже действующий сегодня доступ.
7. Выполняется вручную через Supabase SQL Editor, как и все предыдущие
   миграции проекта (`postgres/migrations` в репозитории нет — см.
   `vault/03-База-данных/Обзор-схемы-БД.md`); каждый шаг — отдельный
   `.sql`-файл в `doc/db/` по уже сложившейся конвенции (например,
   `doc/db/headcount_presence_morning.sql`, `doc/db/days_rls.sql`).

# API изменения

## Edge Function `submit-scan-packet`

`supabase/functions/submit-scan-packet/index.ts`, по паттерну
`delete-user`/`invite-generate`:

1. CORS preflight (`OPTIONS` → `corsHeaders`), как во всех существующих
   функциях.
2. Проверка `Authorization`-заголовка → `anon`-клиент →
   `auth.getUser(token)` → 401 при отсутствии/невалидности.
3. `service_role`-клиент → `SELECT id, active FROM users WHERE user_id =
   <auth uid>` → 403, если пользователь неактивен или не найден. Найденный
   `users.id` становится **единственным источником** `author_id` —
   значение `author_id`/`author` из тела запроса (если клиент его
   пришлёт) игнорируется целиком (план 121, раздел 7).
4. Валидация тела запроса (форма — `tickets/120/120.txt` + уточнения
   плана 121, раздел 7): обязательные `client_packet_id` (uuid), `type`
   (одно из BUS/GROUP/CHECKIN), `date`, `started_at`, `finished_at`,
   `children` (массив, каждый элемент — `child_id`, `timestamp`,
   `method`); `bus_id` обязателен при `type=BUS`, `group_id` — при
   `type=GROUP`. Несоответствие → 400 с описанием проблемы.
5. Маппинг `type` (строка из пакета) → `smallint` (`scan_packets.type`,
   см. «Новые компоненты») — единственное место в системе, где происходит
   это сопоставление.
6. Вызов `supabase.rpc('submit_scan_packet', { payload: {...,
   author_id: <проверенный> } })` — под `service_role`-клиентом.
7. Ответ: `{ packet_id, status }` (200), либо структурированная ошибка
   (400/401/403/500) в JSON-теле, по образцу существующих функций.

## Контракт запроса (тело, JSON)

Соответствует итоговому формату плана 121, раздел 7 — воспроизводится
здесь как обязательный к реализации контракт (не повторное решение,
только формализация для этого тикета):

| Поле | Тип | Обязательность |
|---|---|---|
| `client_packet_id` | uuid (string) | всегда |
| `type` | `'BUS'\|'GROUP'\|'CHECKIN'` | всегда |
| `date` | `'YYYY-MM-DD'` | всегда |
| `started_at`, `finished_at` | ISO timestamp | всегда |
| `bus_id` | smallint | при `type='BUS'` |
| `group_id` | smallint | при `type='GROUP'` |
| `children[].child_id` | bigint | всегда, для каждого элемента |
| `children[].timestamp` | ISO timestamp | всегда |
| `children[].method` | `'SCAN'\|'MANUAL'` | всегда |

`author_id`, даже если прислан клиентом, сервером не читается (шаг 3
выше).

## Новые read-запросы (администратор)

- `useScanPackets.fetchPacketsForBus(busNumber, date)` /
  `fetchPacketsForGroup(groupId, date)` / `fetchRecentPackets(date,
  limit)` — обычные `SELECT` через анонимный/аутентифицированный клиент
  (не Edge Function — чтение не привилегированная операция, RLS
  `SELECT`-политика уже это разрешает, см. «Изменения БД», пункт 5).

# UI изменения

- `AdminBusView.vue` — новая секция «Empfangene Pakete» (список
  последних пакетов за сегодня, вне зависимости от автобуса); переформу­
  лировка текста индикатора Realtime (см. «Изменения существующих
  компонентов»).
- `BusDetailModal.vue` — секция со списком пакетов конкретного автобуса
  (`ScanPacketList.vue`) рядом с существующим списком Betreuer.
- `ChildrenView.vue` — точка входа на новый `GroupDetailModal.vue`
  (мелкое изменение — кнопка/иконка в существующей строке группы).
- `GroupDetailModal.vue` (новый) — по образцу `BusDetailModal.vue`:
  сводка группы (уже читаемая `useGroups.fetchGroupDetails()`, без
  изменений) + `ScanPacketList.vue` для этой группы.
- `ScanPacketList.vue` (новый, общий) — таблица/список: автор, время
  получения, количество детей, статус (обычный/отменён — поле
  `cancelled_at`, хотя сама функция отмены не реализуется в 122, столбец
  статуса в UI не помешает и не требует дополнительной логики, если
  `cancelled_at` всегда `NULL` до появления функции отмены).
- Никаких изменений на `HeadcountView.vue` (не читает `scans`/пакеты
  напрямую, см. «Анализ текущей архитектуры»).

# План реализации

1. Миграция БД: `scan_packets` + индексы, `alter table scans` (`packet_id`,
   `method`), RLS для `scan_packets` — можно выполнить и проверить
   независимо от остального (обратно совместимо, ничего ещё не пишет в
   новые колонки).
2. Переработка триггеров (`on_scan_insert`, `on_children_today_change`)
   на `FOR EACH STATEMENT` + transition tables — после шага 1, до шага 3
   (нужны новые колонки `scans`, но ещё не нужна сама Edge Function);
   регрессионная проверка на существующих одиночных `INSERT`
   (`useScan.createScan()` из `ChildDetailView.vue`) — статьи запускаются
   и на одностроч­ные `INSERT`, так что путь ручного переназначения
   автобуса должен продолжать корректно обновлять `children_today`/
   `groups_today` без изменений в самом `ChildDetailView.vue`.
3. `submit_scan_packet(payload jsonb)` — зависит от шагов 1-2.
4. Edge Function `submit-scan-packet` — зависит от шага 3; тестируется
   изолированно (`curl`/Postman с тестовым токеном), по образцу
   `doc/genkeys_curl.bat` для `invite-generate`.
5. `useScanPackets.js` (read-запросы) — независим от шагов 3-4 по коду
   (можно писать параллельно), но для сквозной проверки нужны реальные
   строки `scan_packets`, то есть фактически после шага 4.
6. `AdminBusView.vue` + `BusDetailModal.vue` (секции пакетов) — после
   шага 5.
7. `GroupDetailModal.vue` + точка входа в `ChildrenView.vue` — после
   шага 5, независимо от шага 6.
8. Сквозная проверка вместе с тикетом 120 (после его реализации
   клиентской стороны): реальная отправка `PresencePacket` из всех трёх
   режимов → проверка `children_today`/`groups_today`/`scan_packets`,
   повторная отправка того же `client_packet_id` (идемпотентность),
   пакет по автобусу с 35+ детьми (один каскад пересчёта, не 35 — можно
   проверить логированием количества срабатываний триггера на тестовом
   пакете).

# Риски

- **Инвариант «в `scans` попадают только пакетные строки» не достигается
  этим тикетом.** `tickets/121/IMPLEMENTATION_PLAN.md` (раздел «Решение
  принято») исходит из допущения «не останется сканеров/путей, кроме
  перечисленных в 120.txt»; на практике `useScan.createScan()`
  (`ChildDetailView.vue`, ручное переназначение автобуса администратором)
  сознательно не тронут ни планом 120, ни этим планом — он не входит ни
  в «три подрежима сканирования», ни в объём 122.txt. Это не блокирует
  122 (`packet_id` остаётся nullable, `method` получает `DEFAULT 1`), но
  означает, что будущий шаг «`packet_id` → `NOT NULL`» (план 121, раздел
  9, явно вынесен за рамки 122) **не может** быть выполнен безопасно, пока
  этот путь жив — нужно либо переписать `ChildDetailView.vue` на пакет из
  одного ребёнка, либо явно принять решение оставить для него отдельный
  `NULL`-путь. Стоит зафиксировать это явно перед тем шагом, а не
  переоткрывать вопрос заново.
- **Совместная разработка с 120.** Контракт `PresencePacket` (поля,
  типы, коды `type`) определён в двух документах (120.txt + план 121,
  раздел 7) и здесь ещё раз формализован числовым маппингом `type`.
  Рассинхронизация между клиентской (120) и серверной (этот тикет)
  реализацией контракта — риск, снижаемый требованием одновременного
  релиза (`122.txt`), но не устраняемый архитектурно; нужна явная сверка
  перед интеграционным тестированием (шаг 8 плана реализации).
- **Транзакционность `submit_scan_packet()`.** Если реализация случайно
  разобьёт вставку `scans` на несколько операторов (например, цикл с
  отдельными `INSERT` на ребёнка внутри функции вместо одного
  `INSERT ... SELECT ... FROM jsonb_to_recordset(...)`) — batch-триггер
  всё равно сработает многократно, и весь смысл раздела 6 плана 121
  теряется незаметно (данные останутся корректными, но производительность
  — нет). Стоит покрыть это отдельной ручной проверкой (шаг 8, «один
  каскад, не 35»), не только функциональным тестом на корректность
  счётчиков.
- **Legacy permissive RLS-политики.** Известная проблема проекта
  (`RLS-политики.md`) — при добавлении политик для `scan_packets` важно
  не создать по недосмотру аналогичную широкую `USING(true)`-политику
  того же действия, иначе новая узкая `SELECT`-политика окажется
  фиктивной тем же способом, что и для `children_today`/`groups_today`
  сегодня.
- **`GroupDetailModal.vue` — новый экран, которого не было.** Это
  наименьшее по объёму соответствие требованию 122.txt «по группам», но
  всё же новый компонент, а не правка существующего — стоит подтвердить
  с владельцем продукта, что drill-down по образцу `BusDetailModal.vue`
  — ожидаемый уровень изменений для групп, а не более лёгкая альтернатива
  (например, просто разворачивающаяся строка в `ChildrenView.vue`).

# Definition of Done

- Миграция применена: `scan_packets` создана с индексами и RLS;
  `scans.packet_id`/`scans.method` добавлены; `on_scan_insert`/
  `on_children_today_change` переведены на `FOR EACH STATEMENT` с
  transition tables.
- `submit_scan_packet(payload jsonb)` реализована и вызывается только
  из Edge Function под `service_role`.
- Edge Function `submit-scan-packet` разворачивается, отклоняет запросы
  без валидного токена/неактивного пользователя, отклоняет пакеты с
  отсутствующими обязательными полями, подставляет `author_id`
  самостоятельно (тело запроса игнорируется), не даёт повторной отправке
  того же `client_packet_id` создать дубликат.
- Пакет по автобусу с 35+ детьми вызывает один цикл пересчёта
  `children_today`/`groups_today`, а не N — проверено вручную (лог
  срабатываний триггера или счётчик вызовов на тестовом пакете).
- `useScan.createScan()`/`ChildDetailView.vue` продолжают работать без
  изменений после переработки триггеров (регрессионная проверка).
- `HeadcountView.vue`/`ChildrenView.vue` (сводная таблица)/`useGroups.js`
  показывают корректные данные после пакетной вставки — без изменений в
  их собственном коде.
- `AdminBusView.vue` показывает список полученных пакетов (общий и по
  каждому автобусу через `BusDetailModal.vue`); индикатор Realtime не
  вводит в заблуждение относительно новой, пакетной природы обновлений.
- `GroupDetailModal.vue` показывает список пакетов для группы.
- Сквозная ручная проверка вместе с реализованным тикетом 120: все три
  режима (BUS/GROUP/CHECKIN) успешно отправляют пакеты, отображаются в
  admin-экранах, повторная отправка после сбоя сети не создаёт
  дубликатов.
