# Цель

Реализовать серверную часть тикета 122: научить сервер принимать пакет
сканирования (`PresencePacket`, клиент уже реализован тикетом 120) через
новую Edge Function, атомарно и идемпотентно сохранять его в новой сущности
`scan_packets` + существующей `scans`, не изменяя итоговых значений
`children_today`/`groups_today` (только гранулярность пересчёта — раздел
«Изменения БД»), и дать администратору видимость полученных пакетов по
автобусам и группам.

Требования и объём взяты из `tickets/122/122.txt` (актуальная редакция).
Архитектурные развилки (модель хранения, точка приёма, идемпотентность,
необходимость батч-переработки триггеров) не пересматриваются — они уже
решены в `tickets/121/IMPLEMENTATION_PLAN.md` и приняты как данность.
Клиентский формат `PresencePacket` зафиксирован в `tickets/120/120.txt` и
уже реализован в `src/composables/useScanPacket.js` — этот документ
проектирует сервер под уже существующий, а не гипотетический контракт.

# Анализ текущей архитектуры

## Схема данных (проверено по `doc/db_triggers.sql`, `doc/database_migration_config_rls.sql`, вэдту `vault/03-База-данных/*`, актуальному коду)

- `scans` — append-only: `id, created_at, date (varchar), user_id (bigint),
  child_id, band_id, bus_id, type (smallint, default 1, зарезервировано)`.
- `children_today` — upsert-таблица, `child_id` уникален, поля
  `presence_today/presence_now/bus_today/bus_now/presence_morning`.
  `presence_morning` пишется один раз (только INSERT-ветка) и никогда не
  перезаписывается — инвариант тикета 106, обязателен к сохранению.
- `groups_today` — производная от `children_today`, полный `COUNT(*)
  FILTER` по группе при каждом релевантном изменении.
- `users` — прикладная таблица поверх `auth.users`: `id` (bigint, то, на
  что ссылаются все прикладные FK, включая будущий `scan_packets.author_id`)
  отдельно от `user_id` (uuid, ссылка на `auth.users(id)`, то, что отдаёт
  `supabase.auth.getUser(token)`). Это разделение — источник главного
  риска реализации Edge Function (раздел «Риски»): токен даёт uuid, а
  `author_id` пакета должен быть bigint `users.id`.
- В репозитории **нет файлов SQL-миграций** — `doc/db_triggers.sql` и
  `vault/03-База-данных/*` документируют уже применённую вручную схему.
  DDL/функции/триггеры этого плана применяются вручную (Supabase SQL
  Editor/CLI), а не через файл миграции — так же, как и все существующие
  таблицы проекта.

## Триггеры пересчёта присутствия (`doc/db_triggers.sql`)

- `on_scan_insert` — `AFTER INSERT ON scans FOR EACH ROW`: находит
  `group_id` ребёнка, `INSERT ... ON CONFLICT (child_id) DO UPDATE` в
  `children_today`. INSERT-ветка — все 5 полей + `presence_morning`;
  `ON CONFLICT DO UPDATE`-ветка — только `presence_now`, `bus_now`,
  `user_id` (сознательно без `presence_morning`).
- `on_children_today_change` — `AFTER INSERT OR UPDATE ON children_today
  FOR EACH ROW`: пересчитывает `groups_today` для `NEW.group_id` полным
  `COUNT(*) FILTER` по группе.
- Оба — построчные. Вставка пакета из N детей одним `INSERT` в `scans`
  сегодня вызвала бы `on_scan_insert` N раз, а `on_children_today_change`
  — до N раз (пока не устранено разделом «Изменения БД»).

## Существующие пути записи в `scans`/`children_today`, которые пакетная переработка не должна сломать

Это существенно для раздела «Риски» и плана регрессионной проверки —
предыдущая версия этого документа фиксировала только один из двух путей,
второй выявлен при подготовке этой версии:

1. **`ChildDetailView.vue` → `useScan.createScan()`** (`src/composables/useScan.js`)
   — прямой одиночный `INSERT` в `scans` (ручная регистрация присутствия
   администратором вне трёх режимов сканирования 120). Явно назван в
   `122.txt` как путь, который нужно сохранить рабочим.
2. **`HeadcountView.vue` (Kopfzählung, тикет 106) → `useChildPresence.setPresentNow()`**
   (`src/composables/useChildPresence.js`) — прямой `SELECT`, затем
   `UPDATE`/`INSERT` **одной строки** в `children_today` (не через
   `scans`/`on_scan_insert` вообще). Не упомянут явно в `122.txt`, но
   зависит от `on_children_today_change` так же, как и пакетная вставка —
   переработка этого триггера (раздел «Изменения БД») обязана сохранить и
   этот путь рабочим. Добавлен в Definition of Done этого документа.

Оба пути вставляют/обновляют **одну строку одним оператором** — при
переводе триггеров на `FOR EACH STATEMENT` они по-прежнему вызовут
триггер (один раз, transition table из одной строки), поведение
пересчёта не меняется. Это ключевое свойство, на котором строится план
переработки (раздел «Изменения БД»): один и тот же батч-триггер
корректно обслуживает и одиночную вставку, и пакетную, без ветвления по
источнику.

## Существующий паттерн привилегированных Edge Function

`supabase/functions/delete-user/index.ts` и `.../invite-generate/index.ts`
(единственные прецеденты, читаны целиком):

1. Клиент с `SUPABASE_ANON_KEY` — `auth.getUser(token)` из заголовка
   `Authorization`, ошибка → `401`.
2. Клиент с `SUPABASE_SERVICE_ROLE_KEY` (`supabaseAdmin`, создан один раз
   на верхнем уровне модуля) — `SELECT role FROM users WHERE user_id =
   <uuid из шага 1>`. Оба прецедента проверяют `role === 'admin'` и
   отказывают `403`.
3. Тело запроса, валидация обязательных полей → `400` при нарушении.
4. Привилегированная операция через `supabaseAdmin`.
5. Единообразные `corsHeaders`, `OPTIONS`-preflight, `try/catch` с `500` на
   необработанную ошибку.

**Отличие для `submit-scan-packet`**: пакеты отправляют обычные Betreuer,
не только admin — авторизационная проверка шага 2 здесь не «role ===
admin», а «пользователь существует и `active = true`» (плюс получение его
`users.id` для `author_id`). Это единственное отклонение от прецедента,
обосновано различием бизнес-смысла операций (см. раздел «API изменения»).

## Что показывает администратор сегодня

- `AdminBusView.vue` — сводная таблица по автобусам (`useBusData.fetchBusData()`
  читает `children_today`/`user_group_day` напрямую, не `scans`), Realtime-
  подписка (`postgres_changes` на `children_today` без фильтра,
  `user_group_day` по дню, `reset_events` INSERT по дню) с debounce-
  перезагрузкой, индикатор `Live/Verbinde.../Offline` — это индикатор
  **состояния соединения** Realtime-канала, а не «пер-скановой» гранулярности
  (в коде нет текста, утверждающего иное) — см. вывод в разделе «UI
  изменения».
- `BusDetailModal.vue` — при открытии грузит `fetchBusChildren`/
  `fetchBusBetreuer` (оба из `useBusData.js`, тоже `children_today`/
  `user_group_day`, не `scans`/пакеты).
- `ChildrenView.vue` (внутреннее имя компонента — `AdminGroupView`,
  маршрут `/children`, `requiresAdmin: true`) — сводная таблица по группам
  (`useGroups.fetchGroupsData()`, тоже без `scans`/пакетов), каждая строка
  — `router-link` на `/group-edit/:id` (редактирование состава группы,
  не про сканы). **Экрана с историей пакетов/сканов по группе сегодня не
  существует** — подтверждено, только `/group-edit/:id`.
- Ни один из существующих запросов не обращается к `scans` — видимость
  «кто прислал пакет» полностью отсутствует, это и есть содержательный
  пробел, который закрывает раздел «UI изменения».

## Клиентский контракт `PresencePacket`, как он уже реализован (`src/composables/useScanPacket.js`)

Это единственный источник истины для формы запроса, который должен принять
Edge Function — клиент (тикет 120) уже написан и задеплоен не будет
переписываться под этот тикет:

```js
{
  client_packet_id: "<uuid, crypto.randomUUID()>",
  type: "BUS" | "GROUP" | "CHECKIN",
  date: "<YYYY-MM-DD>",              // userStore.getTodayDate()
  author_id: <bigint users.id>,      // ВСЕГДА игнорируется сервером
  started_at: "<ISO8601>" | null,    // null, если ни один ребёнок не добавлен
  finished_at: "<ISO8601>",          // выставляется клиентом перед отправкой
  bus_id: <smallint> | null,         // заполнен только при type === 'BUS'
  group_id: <smallint> | null,       // заполнен только при type === 'GROUP'
  children: [
    { child_id: <bigint>, timestamp: "<ISO8601>", method: "SCAN" | "MANUAL" }
  ]
}
```

Запрос: `POST {SUPABASE_URL}/functions/v1/submit-scan-packet`, заголовки
`Content-Type: application/json`, `Authorization: Bearer <access_token>`,
`apikey: <VITE_SUPABASE_KEY>`. Клиент трактует любой `response.ok` как
успех и не разбирает тело ответа кроме as `err.error` при ошибке — форма
успешного ответа проектируется этим документом свободно (раздел «API
изменения»), лишь бы `response.ok` был `true`.

# Затрагиваемые модули

| Модуль | Тип изменения |
|---|---|
| БД: `scans` | ALTER (2 новые nullable/default-колонки) |
| БД: `scan_packets` | НОВАЯ таблица |
| БД: `on_scan_insert` / `trg_on_scan_insert` | Переработка (row → statement) |
| БД: `on_children_today_change` / `trg_on_children_today_change` | Переработка (row → statement) |
| БД: `submit_scan_packet()` | НОВАЯ функция |
| БД: RLS для `scan_packets` | НОВЫЕ политики |
| `supabase/functions/submit-scan-packet/index.ts` | НОВАЯ Edge Function |
| `src/composables/useScanPackets.js` | НОВЫЙ (админ-чтение пакетов; не путать с уже существующим клиентским `useScanPacket.js` тикета 120 — другое имя, другая ответственность) |
| `src/views/AdminBusView.vue` | Изменение (блок «полученные пакеты») |
| `src/components/BusDetailModal.vue` | Изменение (список пакетов автобуса) |
| `src/views/ChildrenView.vue` | Изменение (точка входа в детали группы) |
| `src/components/GroupDetailModal.vue` | НОВЫЙ |
| `src/router/index.js` | Без изменений (см. «UI изменения» — вход через модалку, не маршрут) |

Не затрагиваются (проверено): `useArmband.js`, `useScan.js`,
`useChildPresence.js`, `HeadcountView.vue`, `ChildDetailView.vue`,
`useGroups.js` (существующие функции), `Scanner.vue`, `useScanPacket.js`
(клиент 120) — их поведение подтверждается регрессионной проверкой
(раздел «План реализации»/«Definition of Done»), а не изменяется.

# Изменения существующих компонентов

## `scans` — совместимое расширение

Добавить `packet_id` (nullable — на `scans` продолжает быть возможна
запись в обход пакета, пока путь `ChildDetailView`/`createScan()`
существует; перевод в `NOT NULL` — отдельный будущий шаг, не в этом
тикете, см. `122.txt`/`121`) и `method` (способ получения результата,
default соответствует «обычному» скану — сохраняет смысл для старых и
не-пакетных строк).

## `on_scan_insert` → `on_scan_insert_batch` (`FOR EACH ROW` → `FOR EACH STATEMENT`)

Проблема (раздел «Анализ...»): один `INSERT` из N строк вызывает
построчный триггер N раз. Решение — Postgres transition tables
(`REFERENCING NEW TABLE AS new_table`), доступны с версии 10.

```sql
CREATE OR REPLACE FUNCTION on_scan_insert_batch()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO children_today (
    user_id, child_id, group_id,
    presence_today, presence_now, bus_today, bus_now, presence_morning
  )
  SELECT DISTINCT ON (s.child_id)
    s.user_id, s.child_id, c.group_id,
    1, 1, s.bus_id, s.bus_id,
    CASE WHEN s.bus_id IS NOT NULL THEN 1 ELSE 0 END
  FROM new_table s
  JOIN children c ON c.id = s.child_id
  ORDER BY s.child_id, s.created_at DESC
  ON CONFLICT (child_id) DO UPDATE
    SET presence_now = 1,
        bus_now = EXCLUDED.bus_now,
        user_id = EXCLUDED.user_id;
    -- presence_morning сознательно не в SET, как и в текущей построчной версии (тикет 106)
  RETURN NULL; -- statement-level триггер, NEW/OLD недоступны
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_scan_insert ON scans;
CREATE TRIGGER trg_on_scan_insert
  AFTER INSERT ON scans
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_scan_insert_batch();
```

`DISTINCT ON (s.child_id) ... ORDER BY ... created_at DESC` — на случай
двух строк одного ребёнка в одном статементе (клиент дедуплицирует
внутри раунда, `isDuplicate()`, но сервер не обязан на это полагаться;
без этой защиты `INSERT` с двумя строками одного `child_id` в одном
статементе упал бы на `ON CONFLICT` — Postgres не допускает двух
конфликтующих строк за один `INSERT ... ON CONFLICT`). Если исходная
строка `NEW.user_id` при одиночной вставке (`ChildDetailView`/`createScan`,
Kopfzählung не создаёт строк `scans`) — эквивалентно текущему поведению.

## `on_children_today_change` → `on_children_today_change_batch`

```sql
CREATE OR REPLACE FUNCTION on_children_today_change_batch()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO groups_today (user_id, group_id, children_today, children_now)
  SELECT
    MAX(ct.user_id),
    ct.group_id,
    COUNT(*) FILTER (WHERE ct.presence_today = 1),
    COUNT(*) FILTER (WHERE ct.presence_now = 1)
  FROM children_today ct
  WHERE ct.group_id IN (
    SELECT DISTINCT group_id FROM new_table WHERE group_id IS NOT NULL
  )
  GROUP BY ct.group_id
  ON CONFLICT (group_id) DO UPDATE
    SET children_today = EXCLUDED.children_today,
        children_now = EXCLUDED.children_now,
        user_id = EXCLUDED.user_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_children_today_change ON children_today;
CREATE TRIGGER trg_on_children_today_change
  AFTER INSERT OR UPDATE ON children_today
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_children_today_change_batch();
```

Пересчёт по-прежнему полный `COUNT(*) FILTER` по каждой затронутой
группе (не инкремент) — сохраняет устойчивость к гонкам, только область
пересчёта сужена с «одна группа за вызов» на «все отличные группы этого
статемента за один вызов» вместо «за один вызов на строку». Для
`HeadcountView`/`ChildrenView`/`useGroups` результат неотличим от
сегодняшнего — меняется только количество срабатываний.

**Не переработаны и не тронуты** (не связаны с пакетной вставкой):
`on_reset_event_insert`, `on_children_today_delete`,
`recalculate_groups_today()`.

## `AdminBusView.vue` / `BusDetailModal.vue`

См. «UI изменения» — добавление блока пакетов, без переписывания
существующей логики автобусной сводки.

## `ChildrenView.vue`

Добавить в каждую строку таблицы групп кнопку/иконку, открывающую
`GroupDetailModal.vue` для этой группы — рядом с уже существующим
`router-link` на `/group-edit/:id`, без изменения самой сводной таблицы
(колонки, вычисления, realtime-подписка на `groups_today` — без
изменений, `122.txt`: «без пересмотра существующей сводной таблицы
групп»).

# Новые компоненты

## `scan_packets` (БД)

Заголовок пакета — см. «Изменения БД» за DDL.

## `submit_scan_packet(payload jsonb)` (БД-функция)

Атомарный идемпотентный приём — см. «Изменения БД».

## `supabase/functions/submit-scan-packet/index.ts` (Edge Function)

Публичная точка входа — см. «API изменения».

## `src/composables/useScanPackets.js`

Админ-чтение пакетов (не путать с клиентским `useScanPacket.js` тикета
120 — единственного числа, другой ответственности — сборка/отправка).
Экспортирует:

- `fetchPacketsForBus(busNumber, date)` — пакеты типа `BUS` с этим
  `bus_id` за дату, с именем автора (`join` на `users.display_name` по
  `author_id`).
- `fetchPacketsForGroup(groupId, date)` — то же для типа `GROUP`.

Обе — простой `SELECT` через обычный (не service_role) клиент,
разрешённый RLS-политикой `SELECT` для `authenticated` (раздел «Изменения
БД»).

## `src/components/GroupDetailModal.vue`

По образцу `BusDetailModal.vue` (тот же паттерн модалки: `teleport to
body`, `show`/`groupId` props, `close` emit, `watch(() => props.show,
...)` для загрузки при открытии). Показывает: список полученных
пакетов группы за сегодня (автор, время получения, число детей в
пакете, статус отменён/нет — поле есть в схеме, самой отмены в 122 нет,
поэтому в UI это всегда «нет»), без разбивки по отдельным сканам
(это уровень `scans`, не требуется в `122.txt`).

# Изменения БД

## Новая таблица `scan_packets`

```sql
CREATE TABLE public.scan_packets (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  client_packet_id uuid NOT NULL,
  type smallint NOT NULL,               -- 1=BUS, 2=GROUP, 3=CHECKIN
  author_id bigint NOT NULL REFERENCES users(id),
  bus_id smallint NULL,
  group_id smallint NULL,
  date character varying NOT NULL,       -- совпадает с форматом scans.date
  started_at timestamptz NULL,
  finished_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  children_count smallint NOT NULL DEFAULT 0,
  cancelled_at timestamptz NULL,         -- задел на будущее (121, раздел 10), не используется в 122
  CONSTRAINT scan_packets_pkey PRIMARY KEY (id),
  CONSTRAINT scan_packets_client_packet_id_key UNIQUE (client_packet_id),
  CONSTRAINT scan_packets_type_check CHECK (type IN (1, 2, 3)),
  CONSTRAINT scan_packets_bus_group_check CHECK (
    (type = 1 AND bus_id IS NOT NULL AND group_id IS NULL) OR
    (type = 2 AND group_id IS NOT NULL AND bus_id IS NULL) OR
    (type = 3 AND bus_id IS NULL AND group_id IS NULL)
  )
);

CREATE INDEX idx_scan_packets_bus_date ON scan_packets(bus_id, date) WHERE bus_id IS NOT NULL;
CREATE INDEX idx_scan_packets_group_date ON scan_packets(group_id, date) WHERE group_id IS NOT NULL;
```

`type` — числовое представление введено этим документом как единственный
источник истины (в `120.txt`/`121` типы называются только словами); Edge
Function отвечает за маппинг строки в число (раздел «API изменения»).
`author_id bigint REFERENCES users(id)` — намеренно **не** `uuid` (см.
«Анализ текущей архитектуры» про два разных ID пользователя).

## Расширение `scans`

```sql
ALTER TABLE public.scans
  ADD COLUMN packet_id bigint NULL REFERENCES scan_packets(id),
  ADD COLUMN method smallint NOT NULL DEFAULT 1; -- 1=SCAN, 2=MANUAL

CREATE INDEX idx_scans_packet_id ON scans(packet_id) WHERE packet_id IS NOT NULL;
```

`method` для существующих и будущих не-пакетных строк (`ChildDetailView`/
`createScan()`) остаётся на значении по умолчанию (`1`/SCAN) — эти строки
не описывают «ручную отметку в чек-листе GROUP-режима», у `method` для
них нет содержательного смысла, значение по умолчанию — не более чем
заполнитель для отсутствующей информации, не публикуется как факт в UI.
`band_id` пакетных строк остаётся `NULL` — `PresencePacket.children[]`
не содержит `band_id` (только `child_id`); это осознанное сужение объёма,
а не упущение (см. «Риски»).

## Функция приёма пакета

```sql
CREATE OR REPLACE FUNCTION submit_scan_packet(payload jsonb)
RETURNS TABLE(packet_id bigint, created boolean) AS $$
DECLARE
  v_packet_id bigint;
  v_client_packet_id uuid := (payload->>'client_packet_id')::uuid;
BEGIN
  INSERT INTO scan_packets (
    client_packet_id, type, author_id, bus_id, group_id,
    date, started_at, finished_at, children_count
  )
  VALUES (
    v_client_packet_id,
    (payload->>'type_code')::smallint,
    (payload->>'author_id')::bigint,
    NULLIF(payload->>'bus_id', '')::smallint,
    NULLIF(payload->>'group_id', '')::smallint,
    payload->>'date',
    NULLIF(payload->>'started_at', '')::timestamptz,
    (payload->>'finished_at')::timestamptz,
    jsonb_array_length(COALESCE(payload->'children', '[]'::jsonb))
  )
  ON CONFLICT (client_packet_id) DO NOTHING
  RETURNING id INTO v_packet_id;

  IF v_packet_id IS NULL THEN
    -- Уже существует: либо повтор после потерянного ответа, либо гонка
    -- двух одновременных повторов (в обоих случаях — не создавать заново)
    SELECT id INTO v_packet_id FROM scan_packets WHERE client_packet_id = v_client_packet_id;
    RETURN QUERY SELECT v_packet_id, false;
    RETURN;
  END IF;

  INSERT INTO scans (date, user_id, child_id, bus_id, type, packet_id, method, created_at)
  SELECT
    payload->>'date',
    (payload->>'author_id')::bigint,
    (c->>'child_id')::bigint,
    NULLIF(payload->>'bus_id', '')::smallint,
    1,
    v_packet_id,
    CASE WHEN c->>'method' = 'MANUAL' THEN 2 ELSE 1 END,
    COALESCE(NULLIF(c->>'timestamp', '')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(payload->'children', '[]'::jsonb)) AS c;

  RETURN QUERY SELECT v_packet_id, true;
END;
$$ LANGUAGE plpgsql;
```

Один составной оператор на заголовок + один составной оператор на все
дочерние строки, внутри одной функции = одной неявной транзакции —
падение на любом шаге откатывает оба `INSERT` целиком (атомарность,
`121`, раздел 8). `author_id`/`type_code` в `payload` подставляются Edge
Function, а не берутся из тела запроса клиента как есть (раздел «API
изменения») — сама функция БД не аутентифицирует вызывающего, это уже
сделано на уровне Edge Function, вызывающей её через `service_role`.

## RLS для `scan_packets`

```sql
ALTER TABLE public.scan_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_packets_select_authenticated"
  ON public.scan_packets FOR SELECT
  TO authenticated
  USING (true);

-- Никакой INSERT/UPDATE/DELETE-политики для authenticated не создаётся:
-- запись выполняется только submit_scan_packet() через service_role-клиент
-- внутри Edge Function, который RLS не касается. Это осознанно строже
-- обычной практики проекта (см. vault/03-База-данных/RLS-политики.md,
-- «Неотозванные широкие legacy-политики») — здесь этот шаблон не
-- повторяется.
```

# API изменения

## `POST /functions/v1/submit-scan-packet`

Контракт запроса — см. «Клиентский контракт `PresencePacket`» выше
(неизменный, клиент 120 уже реализован под него).

Шаги реализации (по образцу `delete-user`/`invite-generate`, с
отклонением по проверке роли — см. «Анализ...»):

```ts
// supabase/functions/submit-scan-packet/index.ts
// npx supabase functions deploy submit-scan-packet

const TYPE_CODE = { BUS: 1, GROUP: 2, CHECKIN: 3 }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Токен → auth-пользователь (anon-клиент), как в прецедентах
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser(token)
    if (userErr || !user) return json(401, { error: 'Invalid user token' })

    // 2. uuid → прикладной users.id + active (service_role-клиент)
    //    Проверка "active", а не "role === admin" — отправляют пакеты
    //    обычные Betreuer, не только администраторы (отличие от прецедентов).
    const { data: profile } = await supabaseAdmin
      .from('users').select('id, active').eq('user_id', user.id).single()
    if (!profile?.active) return json(403, { error: 'Account inactive' })

    // 3. Валидация тела запроса
    const body = await req.json()
    if (!body.client_packet_id || !TYPE_CODE[body.type] || !body.date || !body.finished_at)
      return json(400, { error: 'Missing required packet fields' })
    if (body.type === 'BUS' && !body.bus_id) return json(400, { error: 'bus_id required for BUS packet' })
    if (body.type === 'GROUP' && !body.group_id) return json(400, { error: 'group_id required for GROUP packet' })

    // 4. author_id — ВСЕГДА из шага 2, значение из body игнорируется
    const payload = { ...body, type_code: TYPE_CODE[body.type], author_id: profile.id }

    // 5. Атомарный приём через service_role-клиент
    const { data, error } = await supabaseAdmin.rpc('submit_scan_packet', { payload })
    if (error) throw error

    return json(200, { packet_id: data[0].packet_id, created: data[0].created })
  } catch (err) {
    return json(500, { error: err.message })
  }
})
```

(`json()` — обёртка над `new Response(JSON.stringify(...), {status,
headers: {...corsHeaders, 'Content-Type': 'application/json'}})`, как в
обоих прецедентах; полный текст, включая `corsHeaders`/создание клиентов
на верхнем уровне модуля — при написании кода, один в один по образцу
`delete-user/index.ts`.)

Коды ответа: `401` — нет/невалидный токен; `403` — пользователь
деактивирован; `400` — неполное/некорректное тело; `200` — успех
(создан или уже существовал, оба — успех для клиента); `500` — прочее
(в т.ч. ошибка `submit_scan_packet()`, например нарушение
`scan_packets_bus_group_check`, если тело формально прошло валидацию
шага 3, но противоречиво).

# UI изменения

## `AdminBusView.vue`

- Новый блок в карточке (или в `BusDetailModal.vue`, см. ниже) со списком
  последних полученных пакетов (не только по конкретному автобусу —
  общая лента за сегодня опциональна, обязательный минимум — список
  внутри `BusDetailModal.vue` по конкретному автобусу).
- Существующий индикатор `Live/Verbinde.../Offline` **не переименовывается
  и не удаляется** — по коду он уже означает только состояние Realtime-
  соединения, не «пер-скановую» гранулярность (в тексте нет такого
  утверждения). Фактическое поведение изменится (числа в таблице теперь
  будут скачками меняться на N при каждой отправке пакета, а не по
  одному) — это следствие раздела «Изменения БД», не требует правки кода
  индикатора.
- Существующая Realtime-подписка на `children_today`/`user_group_day`/
  `reset_events` не меняется (пакеты по-прежнему обновляют
  `children_today`, просто одним батчем). Отдельная подписка на INSERT в
  `scan_packets` не обязательна для DoD, но допустима как минимальное
  улучшение отзывчивости списка пакетов — не входит в обязательный объём.

## `BusDetailModal.vue`

При открытии (существующий `watch(() => props.show, ...)`) дополнительно
вызывать `fetchPacketsForBus(busNumber, today)` из нового
`useScanPackets.js`, отобразить список: автор (`display_name`), время
получения, количество детей в пакете. Существующие блоки (Betreuer-
список, Kinder-список из `useBusData`) не меняются.

## `ChildrenView.vue`

Добавить в каждую строку таблицы групп кнопку, открывающую
`GroupDetailModal(groupId)`. Никаких изменений в существующих колонках,
вычислениях (`totalMorning`/`totalCurrent`/`missingGroups`) или
Realtime-подписке на `groups_today`.

## `GroupDetailModal.vue` (новый)

По образцу `BusDetailModal.vue` — список пакетов типа `GROUP` для этой
группы за сегодня (`fetchPacketsForGroup()`), та же форма отображения,
что и у автобусов.

## Не требуют изменений (подтверждено этим анализом, не только предположением)

`HeadcountView.vue`, `ChildDetailView.vue`, `GroupEditView.vue`,
`Scanner.vue`, все три `Scanner*View.vue` тикета 120, `useScanPacket.js`
(клиент) — ни один не читает `scan_packets` и не зависит от гранулярности
срабатывания триггеров, только от итоговых значений `children_today`/
`groups_today`/`scans`, которые не меняются по составу (раздел
«Изменения БД»).

# План реализации

1. Применить DDL: `scan_packets` (с constraints/индексами), `ALTER TABLE
   scans` (`packet_id`, `method`), RLS-политика `SELECT` для
   `scan_packets`.
2. Заменить `on_scan_insert`/`trg_on_scan_insert` и
   `on_children_today_change`/`trg_on_children_today_change` на
   постатементные версии. Сразу после — ручная регрессионная проверка
   **обоих** существующих не-пакетных путей записи (раздел «Анализ...»,
   п. «Существующие пути записи»): `ChildDetailView`→`createScan()` и
   `HeadcountView`→`setPresentNow()` — до перехода к следующим шагам,
   чтобы не строить пакетную логику поверх сломанного пересчёта.
3. Реализовать `submit_scan_packet(payload jsonb)`.
4. Реализовать и задеплоить `supabase/functions/submit-scan-packet/index.ts`.
5. Ручная проверка Edge Function напрямую (curl/Postman, реальный
   access token) — все три типа пакета, невалидный токен, неактивный
   пользователь, неполное тело, повтор одного и того же
   `client_packet_id` дважды подряд (ожидается: одна и та же
   `packet_id`, второй раз `created: false`, без новых строк `scans`).
   Клиент 120 менять не потребуется, если контракт совпадает — но эта
   проверка обязана пройти раньше, чем шаг 6, чтобы не тратить сквозной
   тест на устройствах на отладку контракта.
6. Реализовать `useScanPackets.js`.
7. `AdminBusView.vue`/`BusDetailModal.vue` — блок пакетов автобуса.
8. `GroupDetailModal.vue` + точка входа в `ChildrenView.vue`.
9. Полная регрессионная проверка: `HeadcountView`, `ChildrenView`
   (сводная таблица), `AdminBusView` (сводная часть), история сканов
   ребёнка (`ChildDetailView`) — без изменений в собственном коде,
   ожидаемо без изменений в поведении.
10. Сквозная ручная проверка совместно с уже реализованным тикетом 120
    (на реальных устройствах, все три режима, включая повтор отправки
    после сетевого сбоя) — пункт, явно отложенный со стороны 120 до
    готовности 122 (`tickets/120/IMPLEMENTATION_REPORT.md`).

# Риски

- **Путаница `users.id` (bigint) vs `users.user_id` (uuid)** при
  реализации Edge Function — самый конкретный риск этого плана: если
  `author_id` по ошибке подставить как `user.id` из `auth.getUser()`
  (uuid) вместо прикладного bigint `users.id`, вставка в `scans`/
  `scan_packets` упадёt на несовпадении типа/FK, либо (хуже) если тип FK
  ослабить под uuid, `author_id` перестанет быть тем же идентификатором,
  что и везде в проекте. Пример готового решения этой же задачи — шаг
  2 API-контракта выше и оба существующих прецедента.
- **Постатементная переработка триггеров** — минимальный риск ошибки в
  бизнес-логике пересчёта, но с широким радиусом (все экраны присутствия
  зависят от `children_today`/`groups_today`). Смягчение — обязательная
  регрессионная проверка сразу после шага 2 плана реализации, до
  дальнейшей разработки, по обоим путям записи, а не только по одному
  (см. «Анализ...»).
- **Гонка двух одновременных повторов одного `client_packet_id`** —
  покрыта `ON CONFLICT ... DO NOTHING` + повторный `SELECT` в
  `submit_scan_packet()`, но не имеет отдельного авто-теста в этом
  проекте (нет тестовой инфраструктуры) — полагается на ручную проверку
  (план, шаг 5).
- **Отсутствие файлов миграций в репозитории** — DDL/функции/триггеры
  применяются вручную, как и вся остальная схема проекта; риск
  расхождения между окружениями тот же, что уже существует для всей
  БД проекта (не новый риск, но не устраняется этим тикетом).
- **`band_id` пакетных строк `scans` всегда `NULL`** — осознанное
  сужение (children в `PresencePacket` не несут `band_id`), но будущий
  код, ожидающий `band_id` в каждой строке `scans` (если такой появится),
  должен будет отдельно джойнить `children.band_id`.
- **Легаси-паттерн широких RLS-политик** (`vault/03-База-данных/
  RLS-политики.md`) — при реализации важно не добавить по инерции
  permissive `INSERT`/`UPDATE`-политику для `scan_packets` «на всякий
  случай»; раздел «Изменения БД» намеренно её не включает.

# Definition of Done

- `scan_packets` создана с ограничениями (`UNIQUE(client_packet_id)`,
  `CHECK` на `type`/`bus_id`/`group_id`); `scans` дополнена `packet_id`/
  `method`, существующие строки не затронуты.
- `on_scan_insert`/`on_children_today_change` — постатементные версии
  развёрнуты; регрессия подтверждена вручную по **обоим** путям:
  `ChildDetailView`→`createScan()` и `HeadcountView`→`setPresentNow()`.
- `submit_scan_packet()` атомарно вставляет заголовок и все дочерние
  строки одним вызовом; повторный вызов с тем же `client_packet_id` не
  создаёт новых строк ни в `scan_packets`, ни в `scans`, возвращает
  `created: false`.
- Edge Function `submit-scan-packet` задеплоена; отклоняет запросы без
  валидного токена (`401`), от неактивных пользователей (`403`), с
  неполным телом (`400`); всегда сама определяет `author_id`
  (прикладной bigint `users.id`, не uuid), игнорируя присланное значение.
- Пакет от автобуса на 35+ детей вызывает один цикл пересчёта
  `children_today`/`groups_today` (проверено вручную — например, по
  логам/счётчику срабатываний триггера, не по количеству строк
  результата), а не по одному на ребёнка.
- `AdminBusView.vue`/`BusDetailModal.vue` показывают полученные пакеты
  автобуса; аналогичный по возможностям экран (`GroupDetailModal.vue`,
  вызывается из `ChildrenView.vue`) существует для групп.
- `HeadcountView.vue`, `ChildrenView.vue` (сводная таблица),
  `ChildDetailView.vue` (история сканов ребёнка) показывают корректные
  данные без изменений в собственном коде — подтверждено регрессионной
  проверкой.
- Сквозная ручная проверка выполнена совместно с тикетом 120 на реальных
  устройствах: все три режима сканирования успешно отправляют пакеты,
  данные появляются в новых admin-экранах, повторная отправка после
  сетевого сбоя не создаёт дублей ни в `scan_packets`, ни в `scans`.
