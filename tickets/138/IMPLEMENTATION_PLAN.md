# План реализации тикета 138

Только БД — один новый файл-миграция, `src/` не трогается (единственный
писатель `children_today`/`groups_today` после тикета 137 — сам батч-триггер
на `scans`).

## Шаг 0 — грепом подтвердить предпосылки перед реализацией

- `groups_today_user_id_key` — подтверждено отсутствие в живой схеме
  (`backup/database/schema.sql:5138-5142` — есть только
  `groups_today_group_id_key UNIQUE (group_id)`), как и указано в `138.txt`.
  Соответствующий `DROP CONSTRAINT`/`(user_id, date)` не создаются вовсе.
- `recalculate_groups_today()` — грепом по всему репозиторию: реальные вызовы
  (`EXECUTE FUNCTION`/явный `SELECT recalculate_groups_today()`) не найдены
  нигде — ни в триггерах схемы, ни в `src/`. Единственные совпадения —
  комментарии/документация. Функция — задокументированный ручной инструмент
  восстановления (`doc/db_triggers.sql:247`, «Kann verwendet werden, um
  groups_today bei Inkonsistenzen neu zu berechnen»), не мёртвый код в
  смысле «случайно забыто», а сознательно оставленная утилита для ручного
  запуска через SQL Editor. Решение (`138.txt`, п.3 — «по месту»): обновить
  для консистентности с новой date-scoped схемой, а не удалять — иначе
  инструмент восстановления молча ломается при следующем ручном запуске.
- `children_today`/`groups_today` — грепом по `src/`: ноль совпадений вообще
  (после удаления `useChildPresence.js`/`HeadcountView.vue` в тикете 137).
  Значит `own_group_insert_presence_now`/`own_group_update_presence_now`
  (единственный их потребитель был `HeadcountView.vue`) тоже более не имеют
  назначения — отзываются вместе с широкими legacy-политиками, не только они
  (`138.txt`, п.4, условие «если проверка это подтверждает» — подтверждено).
- Живые триггеры на `scans`/`children_today` (`EXECUTE FUNCTION`, грепом по
  `backup/database/schema.sql`) — подтверждено: только
  `on_scan_insert_batch()`, `on_children_today_change_batch()` (×2, INSERT/
  UPDATE) и `on_children_today_delete()`. `on_scan_insert()`/
  `on_children_today_change()` (не-batch) существуют в схеме как мёртвые
  функции без триггера (заменены batch-версиями в тикете 122) — не в объёме
  138, не трогаются.

## Шаг 1 — новый файл `doc/db/date_scoped_daily_tables.sql`

1. `ALTER TABLE children_today/groups_today ADD COLUMN date` + замена
   unique-констрейнтов на `(child_id, date)`/`(group_id, date)` —
   идемпотентно через `DO $$ ... pg_constraint`-проверку (`ADD CONSTRAINT
   IF NOT EXISTS` не существует в Postgres как синтаксис).
2. В том же файле — `on_scan_insert_batch()`/`on_children_today_change_batch()`
   переписаны на новый `ON CONFLICT`-таргет (`138.txt`: обязательно атомарно
   с п.1, иначе первый скан после применения п.1 без п.2 уронит
   `submit_scan_packet()`). Дополнительно:
   - `on_scan_insert_batch()` теперь пишет `date` из `s.date` (дата самого
     скана), а не полагается на DEFAULT колонки (server `now()`) — иначе
     скан, пришедший непосредственно перед полуночью по серверному времени,
     мог бы попасть не в тот день, что `scans.date`/`scan_packets.date`.
   - `on_children_today_change_batch()` теперь группирует по `(group_id,
     date)`, а не только `group_id` — без этого агрегация после миграции
     схлопывала бы счётчики группы по ВСЕМ датам в одну строку
     `groups_today`, либо (при попытке `ON CONFLICT (group_id, date)` без
     `date` в `SELECT`) сразу падала бы `column "date" is null`. `WHERE`
     сужен до `(group_id, date)` пар, реально задетых в `new_table`
     (транзишн-таблица `children_today`, не `scans`) — не пересчитывает
     историю, только затронутый день.
3. `recalculate_groups_today()` — обновлён по той же логике (`GROUP BY
   group_id, date`, `ON CONFLICT (group_id, date)`) — решение «обновить, не
   удалять», см. Шаг 0.
4. RLS: `DROP POLICY IF EXISTS` для трёх широких legacy-политик на каждой
   таблице (`insert`/`update`/`delete`, `USING/WITH CHECK (true)`) + двух
   узких `own_group_*`-политик на `children_today` (подтверждённо неиспользуемы,
   Шаг 0). `SELECT`-политики на обеих таблицах не трогаются — итоговая модель
   идентична `checkpoints` (тикет 132): `SELECT` для `authenticated`, запись
   только через `SECURITY DEFINER`.
5. Не трогается (`138.txt`, «Что прочитать»): `on_children_today_delete()`/
   `trg_on_children_today_delete` (уже инертна после тикета 137 — единственный
   источник `DELETE FROM children_today` исчез).

Файл идемпотентен целиком: `ADD COLUMN IF NOT EXISTS`, констрейнты — через
`DO $$`-проверку `pg_constraint`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY
IF EXISTS`.

## Шаг 2 — `vault/03-База-данных/RLS-политики.md`

Добавлены два блока «Обновление (тикет 138)»: в разделе `[[children_today]]`
(узкие `own_group_*`-политики больше не имеют потребителя) и в разделе
«⚠ Неотозванные широкие legacy-политики» (для `children_today`/`groups_today`
антипаттерн устранён этим тикетом; для `reset_events`/`children`/`config`/
`days` — по-прежнему актуален, не входит в 138).

## Что не входит

Согласно `138.txt`: изменения `src/`; удаление таблиц `children_today`/
`groups_today` целиком (отклонено решением пользователя ещё на этапе 131);
удаление `reset_events`/`on_reset_event_insert` (тикет 137, уже сделано);
`on_children_today_delete()`/`on_scan_insert()`/`on_children_today_change()`
(не-batch) — не трогаются.

## Definition of Done

- `doc/db/date_scoped_daily_tables.sql` подготовлен, идемпотентен.
  **Применение к боевой БД** — ждёт подтверждения пользователя (нет прямого
  доступа к БД в этой сессии), как и все миграции этой серии.
- Ручная проверка на устройстве (реальный скан создаёт строки с сегодняшней
  `date`, без ошибок `ON CONFLICT`; RLS `children_today` без широких
  политик, подтверждено через Supabase SQL Editor) — не выполнена, нет
  доступа к браузеру/устройству/БД в этой сессии.
