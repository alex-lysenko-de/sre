# Измененные файлы

- `src/components/BusDetailModal.vue` — при открытии дополнительно вызывает
  `fetchPacketsForBus(busNumber, today)` из нового `useScanPackets.js`;
  добавлен блок «Empfangene Pakete» (автор, время получения, число детей),
  показывающий пустое состояние, если пакетов ещё нет. Существующие блоки
  (Betreuer-/Kinder-Liste из `useBusData`) не изменены.
- `src/views/ChildrenView.vue` — в каждую строку таблицы групп добавлена
  кнопка-иконка рядом с существующей ссылкой `/group-edit/:id`, открывающая
  новый `GroupDetailModal.vue` для этой группы. Существующие колонки,
  вычисления (`totalMorning`/`totalCurrent`/`missingGroups`) и Realtime-
  подписка на `groups_today` не изменены.
- `src/main.js` — зарегистрирована иконка `faInbox` (Font Awesome) для
  кнопки перехода в `GroupDetailModal.vue`; остальной список иконок не
  изменён.

# Новые файлы

- `doc/db/scan_packets.sql` — SQL-скрипт (применяется вручную через Supabase
  SQL Editor/CLI, как и весь остальной DDL проекта — см. `doc/db_triggers.sql`,
  `doc/db/headcount_presence_morning.sql`, в репозитории нет файлов миграций):
  - `CREATE TABLE scan_packets` (заголовок пакета, constraints/индексы);
  - `ALTER TABLE scans ADD COLUMN packet_id, method`;
  - `on_scan_insert_batch()`/`trg_on_scan_insert` и
    `on_children_today_change_batch()`/`trg_on_children_today_change` —
    построчные триггеры заменены на постатементные (transition tables);
  - `submit_scan_packet(payload jsonb)` — атомарная идемпотентная функция
    приёма пакета;
  - RLS: `SELECT` для `authenticated` на `scan_packets`, без
    `INSERT`/`UPDATE`/`DELETE`-политики для этой роли (комментарий в файле
    прямо предупреждает не добавлять permissive-политику «на всякий случай»
    по аналогии с уже существующей проблемой в
    `vault/03-База-данных/RLS-политики.md`).
- `supabase/functions/submit-scan-packet/index.ts` — Edge Function, точка
  приёма пакета. Реализована один в один по образцу
  `delete-user/index.ts`/`invite-generate/index.ts` (структура клиентов,
  `corsHeaders`, `try/catch` → `500`), с единственным отклонением, прямо
  предусмотренным планом: проверка шага 2 — `active === true`, а не
  `role === 'admin'` (пакеты отправляют обычные Betreuer, не только
  администраторы).
- `src/composables/useScanPackets.js` — админ-чтение пакетов:
  `fetchPacketsForBus(busNumber, date)`, `fetchPacketsForGroup(groupId, date)`.
  Простые `SELECT` через обычный клиент (не service_role), с `join` на
  `users.display_name` по `author_id`, той же формы, что и в
  `useBusData.js`/`useGroups.js`.
- `src/components/GroupDetailModal.vue` — новый компонент по образцу
  `BusDetailModal.vue` (тот же паттерн: `teleport to body`, `show`/`groupId`
  props, `close` emit, `watch(() => props.show, ...)` для загрузки при
  открытии). Показывает список пакетов группы за сегодня (автор, время,
  число детей), без разбивки по отдельным сканам.

# Реализованные изменения

Все пункты реализованы строго по разделам `tickets/122/IMPLEMENTATION_PLAN.md`
«Изменения БД» / «API изменения» / «UI изменения» (SQL, TypeScript и Vue-код
там уже был зафиксирован дословно — этот раздел описывает применение, а не
повторяет исходный текст):

1. **`scan_packets`** — новая таблица-заголовок пакета, `UNIQUE
   (client_packet_id)` как основа идемпотентности, `CHECK` на `type`/
   согласованность `bus_id`/`group_id` по типу пакета.
2. **`scans`** дополнена `packet_id` (nullable, `REFERENCES
   scan_packets(id)`) и `method` (`default 1` = SCAN) — обратно совместимо
   со старыми и не-пакетными строками (`ChildDetailView` → `createScan()`
   не требует изменений, значения по умолчанию покрывают этот путь).
3. **Постатементные триггеры** — `on_scan_insert`/`on_children_today_change`
   заменены на версии `FOR EACH STATEMENT` с `REFERENCING NEW TABLE AS
   new_table`, так что вставка пакета из N детей вызывает один цикл
   пересчёта, а не N. `DISTINCT ON (child_id)` защищает пакетный `INSERT`
   в `children_today` от конфликта двух строк одного ребёнка в одном
   статементе. Оба существующих одно-строчных пути записи
   (`ChildDetailView`→`createScan()`, `HeadcountView`→`setPresentNow()`,
   последний — прямая запись в `children_today`, минуя `scans`) остаются
   рабочими без изменений в их коде: статементный триггер срабатывает и на
   одну строку (transition table из одной записи), логика пересчёта
   идентична построчной версии.
4. **`submit_scan_packet(payload jsonb)`** — один `INSERT` в
   `scan_packets` (`ON CONFLICT (client_packet_id) DO NOTHING`) + один
   составной `INSERT ... SELECT FROM jsonb_array_elements(...)` в `scans`,
   внутри одной функции = одной неявной транзакции. При повторе с тем же
   `client_packet_id` — `v_packet_id` не устанавливается первым `INSERT`,
   функция дочитывает существующий `id` и возвращает `created: false` без
   повторной вставки в `scans`.
5. **Edge Function `submit-scan-packet`** — аутентификация по токену
   (anon-клиент), проверка `active` (service_role-клиент) вместо проверки
   роли, валидация обязательных полей тела (`client_packet_id`, `type`,
   `date`, `finished_at`, плюс `bus_id`/`group_id` по типу), `author_id`
   всегда берётся из проверенного профиля (`profile.id`, bigint), значение
   из тела запроса перезаписывается и не используется. Коды ответа: `401`
   (нет/невалидный токен), `403` (неактивен), `400` (неполное тело), `200`
   (успех, `created: true|false`), `500` (прочее, включая ошибку
   `submit_scan_packet()`).
6. **`useScanPackets.js`** — два простых `SELECT` (`fetchPacketsForBus`,
   `fetchPacketsForGroup`), фильтр по `type`/`bus_id`|`group_id`/`date`,
   сортировка по `received_at desc`, `join` на `users(display_name)`.
7. **`BusDetailModal.vue`** — при открытии дополнительно грузит пакеты
   автобуса и показывает список (автор, время получения, число детей).
   `AdminBusView.vue` не изменён — обязательный минимум по плану уже
   достигнут списком внутри `BusDetailModal.vue`; существующий индикатор
   `Live/Verbinde.../Offline` не переименован и не удалён (по коду это
   индикатор состояния Realtime-соединения, не пер-скановой гранулярности —
   подтверждено самим планом).
8. **`GroupDetailModal.vue` + `ChildrenView.vue`** — новый экран деталей
   группы (аналог `BusDetailModal.vue`) и кнопка-иконка в каждой строке
   сводной таблицы групп, открывающая его. Сама сводная таблица (колонки,
   вычисления, Realtime-подписка на `groups_today`) не изменена.

# Отклонения от плана

Отклонений в реализованном коде/SQL нет — DDL, функция БД, код Edge
Function и структура новых Vue-компонентов реализованы буквально по тексту
`tickets/122/IMPLEMENTATION_PLAN.md`.

Два пункта плана в этой сессии **не выполнены и не могут быть выполнены** —
оба явно предусмотрены самим планом как шаги, требующие реального
окружения, которого нет у сессии разработки (нет доступа к Supabase SQL
Editor/CLI задеплоенного проекта, нет мобильных устройств):

- **Шаг 1–5 плана реализации (применение DDL, деплой Edge Function, ручная
  проверка через curl/Postman)** — SQL из `doc/db/scan_packets.sql` не
  применён к реальной БД, `submit-scan-packet` не задеплоена. Это
  требуется сделать вручную (`npx supabase functions deploy
  submit-scan-packet` + выполнение `doc/db/scan_packets.sql` через SQL
  Editor) до перехода к шагам 9–10 (регрессия и сквозная проверка).
- **Шаги 9–10 плана реализации (регрессионная проверка `HeadcountView`/
  `ChildrenView`/`AdminBusView`/`ChildDetailView` и сквозная ручная
  проверка совместно с тикетом 120)** — не выполнены, поскольку зависят от
  реально применённых DDL/триггеров и задеплоенной функции (см. выше).
  Это тот же самый пункт, что тикет 120 уже отложил до готовности 122
  (`tickets/120/IMPLEMENTATION_REPORT.md`) — теперь код 122 готов, но сама
  сквозная проверка по-прежнему требует шага деплоя, который не входит в
  возможности этой сессии.

Оба пункта не являются архитектурным отклонением — это единственные шаги
плана, физически невыполнимые без ручного доступа к развёрнутой
инфраструктуре, и сам план прямо описывает их как ручные операции
(«применяются вручную», «Ручная проверка Edge Function напрямую»).

# Миграции

Файла миграции в привычном смысле (например, Django/Rails/Prisma) в
проекте нет — это соответствует существующей практике (см. `doc/db_triggers.sql`,
`doc/db/headcount_presence_morning.sql`, `doc/db/days_rls.sql`). SQL для
этого тикета собран в `doc/db/scan_packets.sql` и должен быть применён
вручную через Supabase SQL Editor (или `psql`/CLI) **до** деплоя Edge
Function и до тестирования клиента 120 против неё. Скрипт написан
идемпотентно (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER/
POLICY IF EXISTS` перед созданием) — безопасен для повторного запуска.

# Проверки

- `npm run build` — успешно, 333 модуля (было 330 до этого тикета — три
  новых клиентских файла: `useScanPackets.js`, `GroupDetailModal.vue` и
  правка `main.js`; `submit-scan-packet/index.ts` — Deno Edge Function, не
  входит в клиентскую сборку Vite), без ошибок. Предупреждение Vite про
  размер чанка `index-*.js` (~663 kB) не относится к изменениям этого
  тикета.
- `git status --short src/ supabase/ doc/db/` — изменены/добавлены ровно
  файлы, перечисленные в разделах «Измененные файлы»/«Новые файлы» выше,
  без посторонних правок.
- Прочитан `src/composables/useScan.js` (`createScan()`, путь
  `ChildDetailView.vue`) — делает одиночный `INSERT` в `scans` без
  `packet_id`/`method` в теле; оба новых поля nullable/со значением по
  умолчанию, код не требует изменений и остаётся совместимым с новой
  схемой на уровне анализа кода (фактическая проверка на живой БД — см.
  «Отклонения от плана», шаги 9–10).
- Подтверждено (`git status`), что `useArmband.js`, `src/composables/useScan.js`,
  `src/composables/useChildPresence.js`, `HeadcountView.vue`,
  `ChildDetailView.vue`, `useGroups.js`, `Scanner.vue`, `useScanPacket.js`
  (клиентский, тикет 120), `AdminBusView.vue`, `src/router/index.js` — не
  изменены, как и предусмотрено планом («Затрагиваемые модули» /
  «Не затрагиваются»).
- Ручная проверка на реальной БД/задеплоенной функции/устройствах — не
  выполнена в этой сессии, см. «Отклонения от плана».

# Деплой и исправление после сообщения об ошибке (2026-07-26)

Пользователь сообщил баг: при отправке пакета сканирования (клиент 120)
выводится `Fehler beim Senden, failed to fetch`.

**Диагностика** (без изменений в коде на этом этапе):
- `curl -X OPTIONS .../functions/v1/submit-scan-packet` → `404
  {"code":"NOT_FOUND","message":"Requested function was not found"}`
  (заголовок `sb-error-code: NOT_FOUND`).
- Для сравнения тот же запрос к `delete-user`/`invite-generate`/
  `invite-accept`/`auth` — везде `200`. Значит проблема специфична именно
  для `submit-scan-packet`, а не общая для проекта/окружения.
- `curl .../rest/v1/scan_packets?select=id&limit=1` (анонимный ключ) →
  `200 []` — таблица `scan_packets` в БД существует (SQL из
  `doc/db/scan_packets.sql` к этому моменту уже был применён кем-то вне
  этой сессии; пустой результат ожидаем — RLS отдаёт анониму 0 строк, не
  ошибку).

**Вывод**: это не дефект кода/SQL, а именно тот шаг, что был явно
задокументирован как невыполненный в разделе «Отклонения от плана» —
Edge Function `submit-scan-packet` никогда не была задеплоена. `404` на
preflight-запрос (`OPTIONS`) браузер трактует как провал CORS и показывает
это клиенту как обобщённую сетевую ошибку (`Failed to fetch`), а не как
понятный HTTP-статус — отсюда сообщение в `ScannerBusView.vue`/
`ScannerGroupView.vue`/`ScannerCheckinView.vue` (`scanPacket.errorMessage.value`,
куда попадает `err.message` из `fetch()`).

**Исправление**: с явного подтверждения пользователя выполнен деплой:
```
npx supabase link --project-ref prlivcmqjqjypclkcovl
npx supabase functions deploy submit-scan-packet
```
Проверено повторно: `OPTIONS` → `200`; `POST` без `Authorization` →
`401 UNAUTHORIZED_NO_AUTH_HEADER` (ожидаемое поведение платформы Supabase
для функции без `--no-verify-jwt`, до входа в код самой функции) — функция
теперь доступна и корректно требует токен.

Код `supabase/functions/submit-scan-packet/index.ts` при деплое не менялся.
Оставшийся пункт из «Отклонения от плана» (регрессия по `HeadcountView`/
`ChildrenView`/`AdminBusView`/`ChildDetailView`, сквозная проверка с 120 на
реальных устройствах, включая повтор после сетевого сбоя) по-прежнему не
выполнен — устранение самого «Failed to fetch» не заменяет эти проверки.
