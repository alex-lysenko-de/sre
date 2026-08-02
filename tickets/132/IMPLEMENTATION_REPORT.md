# Что сделано

- Подготовлен `doc/db/checkpoints.sql` (новый файл, один файл на
  таблицу+RLS+RPC+расширение `submit_scan_packet()`, по конвенции
  `doc/db/scan_packets.sql`):
  - `CREATE TABLE IF NOT EXISTS public.checkpoints` — поля по спецификации
    `132.txt`/`131/IMPLEMENTATION_PLAN.md` (`id, type, day, status, created_by,
    created_at, finished_at, finished_by, baseline_children_count`), `status
    CHECK IN (1,2)` — без `CANCELLED`.
  - Частичный уникальный индекс `checkpoints_open_type_per_day ON
    checkpoints(day, type) WHERE status = 1`.
  - `ALTER TABLE scan_packets ADD COLUMN IF NOT EXISTS checkpoint_id`.
  - RLS: только `SELECT` для `authenticated`; никакой политики записи —
    комментарий в файле объясняет почему, со ссылкой на антипаттерн
    `vault/03-База-данных/RLS-политики.md`.
  - Четыре RPC: `create_checkpoint`, `finish_checkpoint`, `reopen_checkpoint`,
    `remove_checkpoint` — все `SECURITY DEFINER`, `SET search_path = public,
    pg_temp`, явная проверка `role='admin' AND active=true` (не
    переиспользует `has_role()`/`is_admin()`).
  - Расширение `submit_scan_packet()` (`CREATE OR REPLACE`) — авто-создание/
    поиск открытой checkpoint перед вставкой `scan_packets`, без нового
    `RAISE EXCEPTION`; идемпотентность по `client_packet_id` и guard на
    `children[]` без `child_id` сохранены без изменений.
- Зафиксирован явный контракт ошибок для RPC (не был явно расписан в
  `132.txt`, потребовался при реализации): `RAISE EXCEPTION '<CODE>'` для
  простых кодов (`NOT_OPEN`/`NOT_FINISHED`/`NOT_FOUND`/`NOT_ADMIN`), для
  `ALREADY_OPEN` — `existingId` передаётся через `DETAIL` (`RAISE EXCEPTION
  'ALREADY_OPEN' USING DETAIL = id::text`), что supabase-js возвращает как
  `error.details` в объекте ошибки `.rpc()`. Задокументировано в шапке
  `checkpoints.sql` — тикет 133 должен использовать именно эту форму при
  разборе ошибок RPC.
- Добавлена сноска в `vault/03-База-данных/RLS-политики.md` (новый раздел
  `[[checkpoints]]`) — таблица спроектирована без антипаттерна «неотозванных
  широких legacy-политик» с самого начала.

# Отклонения от `132.txt`/`IMPLEMENTATION_PLAN.md`

Нет. Реализация точно следует зафиксированной ранее спецификации
(`tickets/131/IMPLEMENTATION_PLAN.md`, `tickets/130/decision.md`,
`useCheckpointsMock.js`). Единственное дополнение — явная фиксация формата
передачи `existingId` в ошибке `ALREADY_OPEN` (см. выше), т.к. ни один из
источников не специфицировал транспортный механизм для RPC-слоя.

# Применение к боевой БД

**Не применено в рамках этой сессии** — по `132.txt`, «Что не входит»,
это отдельный явно подтверждаемый пользователем шаг (как и миграция 122
ранее). Файл идемпотентен, безопасен для повторного запуска.

Ручная проверка (по чек-листу «Результат выполнения тикета» из `132.txt`)
не выполнена — зависит от применения миграции.

# Зафиксировано в дашборде

`tickets/dashboard.md`, `tickets/132/state.txt` → `DEVELOPMENT_DONE`
(разработка готова, применение к боевой БД и ручная проверка — отдельный
подтверждаемый шаг).
