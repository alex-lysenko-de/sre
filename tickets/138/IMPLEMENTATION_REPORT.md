# Что сделано

Только БД, один новый файл-миграция — `src/` не изменялся (согласно
`138.txt`, единственный писатель `children_today`/`groups_today` после
тикета 137 — батч-триггер на `scans`, работает независимо от UI).

## `doc/db/date_scoped_daily_tables.sql` (новый файл, не применён к БД)

**1) Схема.** `children_today`/`groups_today` получают колонку `date`
(`character varying`, формат `YYYY-MM-DD`, тот же, что `scans.date`/
`checkpoints.day`, `DEFAULT to_char(now(), 'YYYY-MM-DD')`). Unique-констрейнты
заменены: `children_today_child_id_key` → `children_today_child_id_date_key
UNIQUE (child_id, date)`; `groups_today_group_id_key` →
`groups_today_group_id_date_key UNIQUE (group_id, date)`. Констрейнт на
`(user_id, date)` для `groups_today` не создаётся —
`groups_today_user_id_key` не существует в живой схеме (подтверждено
`138.txt` заранее, перепроверено этой сессией по `backup/database/schema.sql:
5138-5142`). Замена констрейнтов обёрнута в `DO $$ ... pg_constraint`-проверку
для идемпотентности (у Postgres нет `ADD CONSTRAINT IF NOT EXISTS`).

**2) Батч-триггеры — обновлены в том же файле, что и п.1** (`138.txt`:
раздельное применение уронило бы `submit_scan_packet()` при первом же скане
после п.1 без п.2 — `ON CONFLICT` без совпадающего уникального индекса):
- `on_scan_insert_batch()`: `ON CONFLICT (child_id)` → `(child_id, date)`,
  `INSERT` теперь пишет `date` явно из `s.date` (дата самого скана), а не
  полагается на DEFAULT колонки — не зависит от времени выполнения триггера
  на сервере.
- `on_children_today_change_batch()`: `ON CONFLICT (group_id)` →
  `(group_id, date)`; `GROUP BY` расширен до `ct.group_id, ct.date` (без
  этого — после миграции агрегация схлопнула бы счётчики группы по всем
  историческим датам в одну строку, а `ON CONFLICT (group_id, date)` без
  `date` в `SELECT` не скомпилировался бы); `WHERE` сужен до `(group_id,
  date)`-пар, реально задетых в `new_table` (транзишн-таблица самой
  `children_today`), а не только `group_id` — пересчитывает только
  затронутый день, не всю историю группы.

**3) `recalculate_groups_today()`** — обновлена (`GROUP BY group_id, date`,
`ON CONFLICT (group_id, date)`), не удалена. Грепом подтверждено: не
вызывается ни одним триггером, не встречается в `src/` — но это
задокументированный ручной инструмент восстановления
(`doc/db_triggers.sql:247`), не забытый мёртвый код; решение — обновить для
консистентности с новой схемой, чтобы инструмент не сломался при следующем
ручном запуске из Supabase SQL Editor (`138.txt`, п.3, «решение по месту»).

**4) RLS.** Отозваны (`DROP POLICY IF EXISTS`):
- `children_today`: три широких legacy-политики (`insert`/`update`/`delete`,
  `USING/WITH CHECK (true)`) + `own_group_insert_presence_now`/
  `own_group_update_presence_now`. Последние две — узкие, формально
  корректные, но грепом подтверждено, что их единственный потребитель
  (`HeadcountView.vue`/`useChildPresence.js`) удалён тикетом 137, а после
  этого `src/` не содержит вообще ни одного упоминания `children_today`/
  `groups_today` — писать под аутентифицированной сессией больше некому.
- `groups_today`: три широких legacy-политики (`insert`/`update`/`delete`).

Итоговая модель для обеих таблиц — `SELECT` для `authenticated`, без единой
политики записи (`SELECT`-политики не трогались) — тот же паттерн, что уже
использован для `checkpoints` (тикет 132) и `scan_packets` (тикет 122):
запись только через `SECURITY DEFINER` (здесь — сам триггер на `scans`, под
`service_role`, RLS не применяется).

**Не тронуто** (согласно `138.txt`, «Что прочитать»):
`on_children_today_delete()`/`trg_on_children_today_delete` — уже инертна
после удаления `on_reset_event_insert` в тикете 137 (единственный источник
`DELETE FROM children_today` исчез); `on_scan_insert()`/
`on_children_today_change()` (не-batch версии) — мёртвые функции без
живого триггера (заменены batch-версиями в тикете 122), вне объёма 138.

## `vault/03-База-данных/RLS-политики.md`

Добавлены два блока «Обновление (тикет 138)»:
- в разделе `[[children_today]]` — `own_group_*`-политики больше не имеют
  потребителя, отозваны;
- в разделе «⚠ Неотозванные широкие legacy-политики» — для
  `children_today`/`groups_today` антипаттерн устранён этим тикетом; явно
  отмечено, что для `reset_events`/`children`/`config`/`days` он по-прежнему
  актуален (не входит в 138).

# Отклонения от `138.txt`/`IMPLEMENTATION_PLAN.md`

Нет. Оба места, явно оставленные «на усмотрение реализации» (`recalculate_groups_today()`
— обновить vs удалить; финальный набор RLS-политик на `children_today`),
решены с обоснованием, зафиксированным выше и в `IMPLEMENTATION_PLAN.md`,
Шаг 0/1 — оба варианта были прямо предусмотрены текстом тикета, не являются
отступлением от него.

# Применение к боевой БД / ручная проверка

**Обновление (сессия тикета 139):** `doc/db/date_scoped_daily_tables.sql`
**подтверждена применённой к боевой БД** — коммит `1733ddc` («ticket 138»)
содержит обновлённый `backup/database/schema.sql`, дословно совпадающий с
миграцией (колонки `date`, констрейнты `children_today_child_id_date_key`/
`groups_today_group_id_date_key`, тела `on_scan_insert_batch()`/
`on_children_today_change_batch()`/`recalculate_groups_today()`, все
отозванные RLS-политики). Применена вне этой сессии, тем же способом, что и
для тикета 132 (см. `tickets/132`).

Не выполнено ни в этой, ни в сессии тикета 139 (нет доступа к
браузеру/устройству):
- Ручная проверка: реальный скан (единственный путь после тикета 137)
  создаёт строки в `children_today`/`groups_today` с сегодняшней `date`, без
  ошибок `ON CONFLICT`.

# Зафиксировано в дашборде

`tickets/dashboard.md`, `tickets/138/state.txt` → `DEVELOPMENT_DONE`.
