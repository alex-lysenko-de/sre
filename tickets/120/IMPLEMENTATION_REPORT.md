# Измененные файлы

- `src/composables/useArmband.js` — удалён `recordChildPresence()` и его
  экспорт; добавлен `getChildrenByGroupOrderedById(groupId)` (тот же запрос,
  что и в `getChildrenByGroup()`, но `order('id', { ascending: true })` и
  колонки `id, name, band_id` вместо `id, name, age, band_id, schwimmer`).
  `getChildrenByGroup()` не изменён.
- `src/router/index.js` — записи `/scanner` (`Scanner`) и `/scanner-prototype`
  (`ScannerPrototype`) заменены тремя новыми: `/scanner/bus` (`ScannerBus`),
  `/scanner/group` (`ScannerGroup`), `/scanner/checkin` (`ScannerCheckin`),
  все с `meta: { requiresAuth: true, requiresAdmin: false }`, lazy `import()`.
- `src/views/MainView.vue` — кнопки «Scannen» и «Scannen (Neu, Prototyp)» вместе
  с обработчиками `goToScan()`/`goToScanPrototype()` удалены; добавлены три
  новые кнопки («Bus zählen» → `/scanner/bus`, «Gruppen-Appell» →
  `/scanner/group`, «Freie Meldung» → `/scanner/checkin`) с обработчиками
  `goToScanBus()`/`goToScanGroup()`/`goToScanCheckin()`. BUS/GROUP — кнопка
  видна всегда авторизованному пользователю, но `:disabled` без
  `bus_id`/`group_id` соответственно, подпись меняется на «Kein Bus
  zugewiesen»/«Keine Gruppe zugewiesen»; CHECKIN — без условий.

# Новые файлы

- `src/composables/useScanPacket.js` — единственное место сборки/отправки
  `PresencePacket`: `createPacket(type, context)`, `isDuplicate(childId)`,
  `addScanned(child)`, `addManual(child)`, `resetPacket()`,
  `submitPacket()` (реальный `fetch()` к Edge Function
  `submit-scan-packet`, по образцу `InviteGeneratorView.vue`). Внутреннее
  состояние: `packet` (reactive), `status`
  (`'idle'|'sending'|'sent'|'error'`), `errorMessage`. Существует только в
  памяти текущего экземпляра composable, не сохраняется в
  `localStorage`/LocalForage.
- `src/views/ScannerBusView.vue` — режим BUS: `Scanner.vue` + счётчик +
  «последний найденный» + список без дублей под кнопками `[Reset]
  [Senden]`.
- `src/views/ScannerGroupView.vue` — режим GROUP: загружает ростер группы
  через `getChildrenByGroupOrderedById()`, чек-лист найденных/ненайденных
  (`N / Total`), тап по ненайденному — ручная отметка (`method: 'MANUAL'`).
- `src/views/ScannerCheckinView.vue` — режим CHECKIN: без ростера/ручной
  отметки, список сразу под счётчиком, каждая строка показывает группу
  ребёнка.

# Реализованные изменения

1. **`useArmband.js`**: `recordChildPresence()` удалён (единственный
   вызывающий, `ScannerView.vue`, удалён этим же тикетом); поиск по `src/`
   подтверждает отсутствие других вызывающих. Добавлен
   `getChildrenByGroupOrderedById()` для ростера GROUP.
2. **`useScanPacket.js`**: реализован по сигнатурам из плана. `createPacket`
   генерирует `client_packet_id` через `crypto.randomUUID()`, ставит
   `date`/`author_id` из `userStore`, `bus_id`/`group_id` — только для
   соответствующего `type`. `addScanned`/`addManual` — no-op при дубликате,
   фиксируют `started_at` для первой записи. `submitPacket()` ставит
   `finished_at`, делает `fetch()` к
   `{VITE_SUPABASE_URL с .co→.co/functions/v1}/submit-scan-packet` с
   заголовками `Authorization`/`apikey` (паттерн `InviteGeneratorView.vue`);
   при ошибке пакет и `client_packet_id` не изменяются — повторный вызов
   `submitPacket()` переотправляет тот же объект.
3. **Три режима-экрана**: каждый монтирует `<Scanner
   :on-child-resolved="handleResolved">` (компонент не изменён) и держит
   собственный `useScanPacket()`. Дедупликация «в рамках захода» — через
   `scanPacket.isDuplicate()` в `handleResolved`, повтор показывает
   `{variant:'success', repeat:true}` (стандартный успешный тон, без
   отдельного «duplicate»-сигнала — тот же паттерн, что и в
   `ScannerPrototypeView.vue` тикета 116). BUS/CHECKIN сознательно не
   проверяют принадлежность ребёнка группе — резолв браслета уже не
   фильтрует по группе (120.txt, «Важные нюансы»).
4. **GROUP — открытый вопрос решён по ответу в 120.txt**: если
   `child.group_id !== groupId`, `handleResolved` возвращает
   `{variant:'error', title:'Kind gehört nicht zu dieser Gruppe',
   subtitle: child.name}` и не добавляет ребёнка ни в пакет, ни в ростер —
   это ошибка бизнес-логики (несоответствие режиму), а не ошибка
   сканирования, что и требовалось разделить по тексту задачи.
5. **`router/index.js`**: три новых маршрута вместо `/scanner` и
   `/scanner-prototype`, тот же паттерн (`requiresAuth`, lazy import).
6. **`MainView.vue`**: три новые кнопки вместо «Scannen»/ссылки на
   прототип. Решение по верстке недоступности (не архитектурная развилка,
   решается при реализации, план): кнопка остаётся видимой авторизованному
   пользователю всегда, но `:disabled`, если нет `bus_id`/`group_id`, с
   изменённой подписью-подсказкой — вместо полного скрытия кнопки, чтобы
   было видно, что режим существует, но недоступен, и почему.
7. **Удаление**: `src/views/ScannerView.vue` и
   `src/views/ScannerPrototypeView.vue` удалены из кодовой базы полностью
   (не архивированы), после того как на них не осталось ссылок ни из
   роутера, ни из меню — подтверждено `grep` по `src/`.

# Отклонения от плана

Отклонений нет — реализация строго следует
`tickets/120/IMPLEMENTATION_PLAN.md`: те же новые/изменяемые/удаляемые
файлы, та же сигнатура `useScanPacket.js`, тот же контракт
`submit-scan-packet`, три отдельных View (не единый параметризуемый
компонент — обоснование уже в самом плане и не пересматривалось).

# Миграции

Нет. Тикет чисто клиентский — схема БД, Edge Function `submit-scan-packet`
и любые серверные изменения принадлежат тикету 122 (не входят в объём 120).

# Проверки

- `git status --short src/ tickets/120/` — изменены/добавлены/удалены ровно
  те файлы, что перечислены в разделах выше и в плане; посторонних правок
  нет.
- `npm run build` — успешно, 330 модулей, без ошибок; предупреждение
  Vite про размер чанков (`index-*.js` ~657 kB) не относится к изменениям
  этого тикета (существовало и раньше, не устраняется в рамках 120).
- Поиск по `src/` (`grep`) подтверждает: `recordChildPresence` больше не
  встречается ни в определении, ни в вызовах; `/scanner`,
  `/scanner-prototype`, `ScannerView`, `ScannerPrototypeView` не встречаются
  нигде в функциональном коде (только в исторических комментариях внутри
  `Scanner.vue`, который по плану не подлежит изменению, и в комментариях
  новых View, ссылающихся на паттерн-прообраз из тикета 116 — не
  функциональные ссылки).
- `AdminBusView.vue`, `src/composables/useScan.js`, `ChildDetailView.vue`,
  `src/components/scanner/Scanner.vue`,
  `src/composables/useScannerFeedback.js` — не изменены (подтверждено
  `git status`).
- **Не выполнено в этой сессии** (нет доступа к устройствам и к реально
  задеплоенной Edge Function `submit-scan-packet` — её реализация
  принадлежит параллельному тикету 122, во время разработки 120 эндпоинт
  недоступен): сквозная ручная проверка на реальных Android-/
  iPhone-устройствах для всех трёх режимов (Definition of Done, пункт
  «Ручная проверка ...»), включая проверку поведения при отсутствии
  `bus_id`/`group_id`, повтор отправки после сетевой ошибки и реальный
  успешный `submit-scan-packet`. Это прямо предусмотрено самим планом
  (шаг 9 «План реализации»: «после интеграции с реально задеплоенной Edge
  Function ..., не против мока») — сквозная проверка должна выполняться
  совместно с готовым тикетом 122, а не в рамках этой сессии.

# Исправления после ревью

По итогам `tickets/120/REVIEW_REPORT.md` (`CHANGES_REQUIRED`):

**Обязательные пункты:**

1. Сквозная ручная проверка на реальных устройствах — не выполнена и в
   этом раунде (нет доступа к устройствам и к реально задеплоенной
   `submit-scan-packet`, эндпоинт — зона ответственности тикета 122).
   Статус не изменился с прошлого отчёта: осознанно отложено до
   совместного релиза с 122, как и предусмотрено планом (шаг 9).
2. Major №1 (рассинхронизация звук/вибро vs визуальный результат при
   скане «чужой» группы в GROUP) — принято явное решение: **осознанно
   принять и задокументировать риск**, без изменения контракта
   `Scanner.vue` (он по плану 120 не подлежит изменению). Решение
   зафиксировано комментарием в `ScannerGroupView.vue` (над
   `<template>`), поясняющим, что звук/вибрация привязаны к статусу
   резолва браслета (`Scanner.vue`, до вызова `onChildResolved`), а не к
   `variant` результата, и что расширение контракта `Scanner.vue` (если
   потребуется) — предмет отдельного тикета.

**Необязательные улучшения — исправлены:**

- Minor №2: `useScanPacket.submitPacket()` больше не перезаписывает
  `packet.finished_at` при повторной попытке после ошибки — значение
  выставляется один раз, до первой успешной/неуспешной отправки.
- Minor №3: все три View (`ScannerBusView`, `ScannerGroupView`,
  `ScannerCheckinView`) теперь показывают `scanPacket.errorMessage.value`
  в сообщении об ошибке отправки (с тем же текстом-заглушкой как
  fallback, если сообщение почему-то пустое).
- Minor №4: `ScannerGroupView.vue` — в блоке ошибки загрузки ростера
  добавлена кнопка «Erneut versuchen», повторно вызывающая `loadRoster()`.

**Необязательные улучшения — не тронуты (сознательно):**

- Minor №1 (кнопка «Повторить» вместо повторного нажатия «Senden») —
  ревью само отметило это как функционально эквивалентное и не
  блокирующее, паттерн уже был одобрен в 116; изменение не вносилось,
  чтобы минимизировать правки.
- Minor №5 (общий хелпер для `handleSend`/`handleReset`) — оставлено как
  технический долг без изменений: вынесение в общий хелпер — это
  рефакторинг/новая абстракция поверх трёх Views, а задача этого раунда
  — точечные исправления найденных проблем, а не рефакторинг.

# Измененные файлы

- `src/composables/useScanPacket.js` — `submitPacket()`: `finished_at`
  выставляется только если ещё не установлен (Minor №2).
- `src/views/ScannerBusView.vue` — сообщение об ошибке отправки
  показывает `scanPacket.errorMessage.value` (Minor №3).
- `src/views/ScannerCheckinView.vue` — то же (Minor №3).
- `src/views/ScannerGroupView.vue` — то же (Minor №3); кнопка повтора
  загрузки ростера (Minor №4); комментарий, документирующий принятое
  решение по Major №1.

# Проверки

- `npm run build` — успешно, без ошибок (только предупреждение Vite про
  размер чанка `index-*.js`, не относящееся к этим изменениям).
- `git status --short src/ tickets/120/` — изменены ровно 4 файла
  (`useScanPacket.js`, три View), без посторонних правок.
- Изменения точечные: не затронуты `Scanner.vue`, роутер, `MainView.vue`,
  `useArmband.js`, контракт `submit-scan-packet` — архитектура не менялась.
