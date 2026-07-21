# `config`

> Источники: `doc/table_structure.md`, `doc/database_migration_config_rls.sql`.

Глобальная конфигурация приложения в формате key/value.

```sql
create table public.config (
  key text not null,
  value text null,
  sort_order integer null,
  updated_at timestamptz null,
  constraint config_pkey primary key (key)
);
```

Известные ключи (используются в коде): `total_groups`, `total_buses`, `year`,
`base_url`, `ankunftszeit`, `abfahrtszeit`, `public_phone_number`.

`total_groups`/`total_buses` — единственное место, где хранится «количество»
групп/автобусов, поскольку сами группы/автобусы не являются отдельными
таблицами (см. [[Обзор-схемы-БД]], [[Группы-и-рабочий-день]]).

## RLS

- `SELECT` — публичный (`TO public USING (true)`): страница `/info`
  неавторизована и читает `config.public_phone_number` без сессии.
- `INSERT`/`UPDATE`/`DELETE` — только активные `admin` (проверка на уровне
  БД, единственная точка контроля — клиентская проверка в `ConfigView.vue`
  удалена как чисто UX-подсказка). См. [[RLS-политики]].

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
