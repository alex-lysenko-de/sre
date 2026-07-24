# `config`

> Источник: `backup/database/schema.sql` (реальный `pg_dump`, тикет 111) —
> предыдущая версия этой заметки опиралась на устаревший
> `doc/table_structure.md` (удалён в тикете 118) и пропускала `description`/`access_level`/`name`
> (см. `tickets/108/REVIEW_REPORT.md`, Critical 1).

Глобальная конфигурация приложения в формате key/value.

```sql
create table public.config (
  key character varying not null,
  value character varying not null,
  description character varying null,
  updated_at timestamptz null default now(),
  access_level smallint null default '1'::smallint,
  name character varying null,
  sort_order smallint null,
  constraint config_pkey primary key (key)
);
```

Известные ключи (используются в коде): `total_groups`, `total_buses`, `year`,
`base_url`, `ankunftszeit`, `abfahrtszeit`, `public_phone_number`.

`total_groups`/`total_buses` — единственное место, где хранится «количество»
групп/автобусов, поскольку сами группы/автобусы не являются отдельными
таблицами (см. [[Обзор-схемы-БД]], [[Группы-и-рабочий-день]]).

## RLS — на практике полностью открыта, `access_level` декоративен

Формально в БД есть политика `"Public read access" ON config FOR SELECT
USING (access_level = 3)` — по названию похоже, что чтение зависит от
`access_level` конкретной строки. На деле рядом действуют ещё две
permissive-политики SELECT без всякого условия — `"Allow public read
config"` и `"Allow read for all users"`, обе `USING (true)`. Так как
PostgreSQL объединяет несколько permissive-политик одного действия через
**OR**, `access_level` ни на что не влияет: любая строка `config` читается
кем угодно, включая неавторизованных. То же для записи: `"Allow insert for
all users"` (`WITH CHECK (true)`) и `"Allow update for all users"` (`USING
(true)`) не имеют ни `TO authenticated`, ни проверки роли — они разрешают
запись даже анонимным запросам, несмотря на то что рядом есть отдельная,
корректно написанная `"Allow admins to manage config"` (`TO authenticated`,
проверка `role = 'admin'`). См. [[RLS-политики]] — тот же паттерн
(неотозванные широкие legacy-политики поверх узких) касается ещё нескольких
таблиц.

## Кто читает/пишет

- `stores/config.js` (Pinia store `useConfigStore`) — `fetchFromSupabase()`,
  `loadConfig()` (кэш в `localStorage`, TTL 5 минут), `updateConfig()`,
  realtime-подписка на изменения (`postgres_changes` на `config`)
- [[useGroups]] — `configStore.totalGroups` при построении списка всех групп
- `ConfigView.vue` — экран редактирования (admin-only, `/config`)

## Связанные заметки

- [[Группы-и-рабочий-день]]
- [[RLS-политики]]
- [[Обзор-схемы-БД]]
