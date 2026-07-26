# Тикет 120 — Архитектурный план: три режима сканирования

Входные данные: `tickets/120/120.txt` (единственный актуальный источник
требований — переработан, содержит уже дистиллированные решения, без
истории обсуждений), `vault/` (архитектурные конвенции проекта,
предметная область, схема БД), исходный код `src/`.
`tickets/120/DECISIONS.md` — архивный документ, не используется как
источник требований (полностью поглощён `120.txt`).

Согласовано с параллельными архитектурными документами: `tickets/121/IMPLEMENTATION_PLAN.md`
(серверное решение по хранению/идемпотентности) и `tickets/122/IMPLEMENTATION_PLAN.md`
(детальный контракт Edge Function `submit-scan-packet`, включая точный
маппинг `type`/`method`). Этот документ **не переопределяет** контракт
121/122 — он фиксирует, что клиент 120 обязан отправлять данные строго
по уже согласованному контракту.

# Цель

Заменить единственный сегодняшний сканер (`/scanner`, `ScannerView.vue`)
тремя маршрутами-режимами («Bus zählen», «Gruppen-Appell», «Freie
Meldung»), построенными поверх уже готового, протестированного и
одобренного заказчиком компонента `Scanner.vue` (тикет 116). Каждый
режим самостоятельно ведёт локальный `PresencePacket` и отправляет его
целиком по кнопке «Отправить» на Edge Function `submit-scan-packet`
(реализуется параллельно тикетом 122). Задача чисто клиентская: ни
схема БД, ни серверная логика в объём 120 не входят.

# Анализ текущей архитектуры

- **Слоистая конвенция проекта** (`CLAUDE.md`, `vault/04-.../stores-user.md`):
  `stores/useXXX` (состояние) → `composables/useXXX` (бизнес-логика) →
  прямой доступ к Supabase/Edge Function. Существующие примеры такого
  разделения: `useBusData.js`, `useGroups.js`, `useArmband.js`. Тикет
  120 обязан следовать этой же схеме, а не собирать логику пакета прямо
  в шаблонах View, как это (в порядке исключения, единственный
  прецедент в проекте) сделано в `InviteGeneratorView.vue`.
- **`Scanner.vue` (`src/components/scanner/Scanner.vue`, тикет 116,
  `DONE`)** — нижний, полностью переиспользуемый слой. Контракт:
  единственный обязательный проп `onChildResolved(result) → Promise<override|undefined>`,
  где `result` — один из `{status:'invalid'}` / `{status:'error', bandId}` /
  `{status:'not-found', bandId}` / `{status:'found', child, bandId}`
  (`child` = `{id, name, age, group_id, band_id, schwimmer, notes}`, поля
  `children`). Компонент сам проигрывает сигнал/вибрацию/экран
  подтверждения по умолчанию для каждого исхода; вызывающий может
  переопределить `{title, subtitle, variant, repeat}` (уже
  использованный в `ScannerPrototypeView.vue` паттерн для сигнала
  «уже отсканирован» — `variant:'success', repeat:true`). Экспортирует
  `defineExpose({ stop, showMessage })`. Не содержит бизнес-логики
  режимов, не знает про `PresencePacket` — это ответственность слоя
  выше, что и подтверждает `120.txt`, раздел «Базовая реализация».
- **`useScannerFeedback.js`** — примитивы Web Audio/vibration без
  пресетов, используется `Scanner.vue`; режимам он не нужен напрямую
  (весь фидбек уже инкапсулирован в `Scanner.vue`), кроме случая,
  описанного в `120.txt` («сигнал «уже отсканирован»») — который
  реализуется через override `onChildResolved`, а не прямой вызов
  `useScannerFeedback`.
- **`ScannerView.vue` (боевой, удаляется)** — держит собственную камеру/
  decode/фидбек-логику (дублирует то, что уже вынесено в `Scanner.vue`
  тикетом 116) и единственный прямой писатель `useArmband.recordChildPresence()`
  → `INSERT INTO scans` без пакетной модели. Других вызывающих
  `recordChildPresence()` в `src/` нет.
- **`ScannerPrototypeView.vue` (прототип 116, удаляется)** — уже
  собирает объект по форме `PresencePacket` (жёстко как `GROUP`,
  осознанное упрощение прототипа) и уже реализует дедупликацию «в
  рамках захода» через override `onChildResolved`. Это готовый образец
  паттерна для трёх боевых режимов 120 — их `handleResolved`
  реализуется по тому же образцу, просто с реальной сборкой всех трёх
  типов пакета и реальной отправкой вместо заглушки.
- **`MainView.vue`** — меню кнопок-карточек (иконка + заголовок +
  подпись + стрелка), `v-if`-условия на `isAuthenticated`/
  `userStore.userInfo.group_id`/`userStore.isAdmin`. Кнопка «Scannen»
  (`goToScan()` → `/scanner`) и временная кнопка-ссылка на прототип
  (`goToScanPrototype()` → `/scanner-prototype`) — обе заменяются.
  Готовый образец предупреждения «Keine Gruppe zugewiesen» (блок под
  меню) — используется как образец для новых предупреждений о
  недоступности BUS/GROUP без переизобретения паттерна.
- **`src/router/index.js`** — маршруты `/scanner`
  (`() => import('@/views/ScannerView.vue')`) и `/scanner-prototype`
  (`() => import('@/views/ScannerPrototypeView.vue')`), оба
  `{ requiresAuth: true, requiresAdmin: false }`, lazy-loaded — новые
  три маршрута следуют этому же образцу.
- **`useArmband.js`** — `getBraceletStatus(bandId)` (используется
  `Scanner.vue`, без изменений), `getChildrenByGroup(groupId)`
  (единственный вызывающий — `ArmbandView.vue`, сортировка по `name` —
  предназначена для формы привязки браслета, не для ростера GROUP-
  режима, поэтому не переиспользуется как есть, см. «Новые
  компоненты»), `recordChildPresence()` (удаляется).
- **`useScan.js`/`ChildDetailView.vue`** — `createScan()`, единственный
  оставшийся после 120 прямой путь `INSERT INTO scans` (админский
  ручной пересчёт). Явно вне рамок 120 (`120.txt`, «Базовая
  реализация») — подтверждено также `tickets/122/IMPLEMENTATION_PLAN.md`
  (риски): этот путь сознательно не трогается ни 120, ни 122.
- **Контракт `submit-scan-packet`** (уже детально специфицирован
  `tickets/122/IMPLEMENTATION_PLAN.md`, раздел «API изменения» —
  120 обязан ему соответствовать буква в букву): `POST`,
  `Authorization: Bearer <session.access_token>`, тело — JSON
  `PresencePacket` (см. «API изменения» ниже); ответ `{ packet_id,
  status: 'created'|'duplicate' }` (200) либо структурированная ошибка
  (400/401/403/500). Единственный существующий прецедент вызова Edge
  Function из `src/` — `InviteGeneratorView.vue` (`generateInvite()`):
  `fetch()` напрямую (не `supabase.functions.invoke()`, этот метод в
  `src/` не используется нигде), URL строится из
  `import.meta.env.VITE_SUPABASE_URL.replace('.co', '.co/functions/v1')`,
  заголовки `Content-Type`, `Authorization: Bearer <access_token>`,
  `apikey: VITE_SUPABASE_KEY`.
- **`config.total_groups`/`config.total_buses`** (`useConfigStore`) —
  группы/автобусы не отдельные таблицы, а диапазон `1..N` (`vault/03-.../Обзор-схемы-БД.md`).
  Для GROUP-режима это означает, что ростер группы — не отдельная
  сущность, а просто `children`, отфильтрованные по `group_id`.
- **`scans.type`** (smallint, справочник `scan_type`) — существующее
  поле, семантически **не связанное** с новым `PresencePacket.type`
  (`BUS`/`GROUP`/`CHECKIN`) и с будущим `scan_packets.type` из плана
  122. Совпадение имени поля — источник потенциальной путаницы при
  реализации, зафиксировано отдельно в «Рисках».

# Затрагиваемые модули

**Новые:**
- `src/composables/useScanPacket.js` — сборка и отправка `PresencePacket`,
  общая для всех трёх режимов.
- `src/views/ScannerBusView.vue`, `src/views/ScannerGroupView.vue`,
  `src/views/ScannerCheckinView.vue` — три экрана-режима.

**Изменяемые:**
- `src/composables/useArmband.js` — удаление `recordChildPresence()`,
  добавление `getChildrenByGroupOrderedById(groupId)`.
- `src/views/MainView.vue` — три новые кнопки меню вместо «Scannen» и
  ссылки на прототип.
- `src/router/index.js` — три новых маршрута вместо `/scanner` и
  `/scanner-prototype`.

**Удаляемые:**
- `src/views/ScannerView.vue`.
- `src/views/ScannerPrototypeView.vue`.

**Не затрагиваемые** (обоснование — раздел «Анализ» и `120.txt`,
«Базовая реализация»): `src/components/scanner/Scanner.vue`,
`src/composables/useScannerFeedback.js`, `src/composables/useScan.js`,
`src/views/ChildDetailView.vue`, `src/views/AdminBusView.vue`, схема
БД, любые Edge Functions (в т.ч. сама функция `submit-scan-packet` —
её реализация принадлежит 122, 120 только вызывает её по готовому
контракту).

# Изменения существующих компонентов

## `src/composables/useArmband.js`

- Удалить `recordChildPresence(userId, childId, bandId, busId)` и её
  экспорт — единственный вызывающий (`ScannerView.vue`) удаляется этим
  же тикетом, других вызывающих в `src/` нет (проверено).
- Добавить `getChildrenByGroupOrderedById(groupId)` — тот же запрос к
  `children` по `group_id`, что и в существующем `getChildrenByGroup()`,
  но с `order('id', { ascending: true })` вместо `order('name')`.
  **Не переиспользовать и не менять** существующий `getChildrenByGroup()` —
  он используется `ArmbandView.vue` для формы привязки браслета, где
  сортировка по имени осмысленна и не должна незаметно измениться из-за
  требования 120.txt («список выводится в порядке `id`»). Отдельная
  функция — с полностью совпадающим сигнатурным стилем, отличается
  только `order()` и (при необходимости) набором выбираемых колонок под
  нужды ростера GROUP-режима (`id, name, band_id` — без `age`/`schwimmer`,
  если UI режима их не показывает; точный список — на усмотрение
  реализации, не архитектурная развилка).

## `src/views/MainView.vue`

Кнопка «Scannen» (`goToScan()`) и кнопка-ссылка на прототип
(`goToScanPrototype()`) удаляются вместе со своими обработчиками.
Добавляются три кнопки по образцу существующего паттерна
карточки-кнопки (иконка + заголовок + подпись + стрелка,
как у «Kopfzählung»/«Busse»):

| Кнопка | `v-if` | Заголовок/подпись | Переход |
|---|---|---|---|
| BUS | `isAuthenticated && userStore.userInfo.bus_id` | Bus zählen / Kinder im Bus scannen | `/scanner/bus` |
| GROUP | `isAuthenticated && userStore.userInfo.group_id` | Gruppen-Appell / Anwesenheit der Gruppe prüfen | `/scanner/group` |
| CHECKIN | `isAuthenticated` | Freie Meldung / Kinder frei melden | `/scanner/checkin` |

Условие недоступности BUS/GROUP реализуется тем же паттерном, что уже
существует для блока «Keine Gruppe zugewiesen» под меню (алерт вместо
кнопки или задизейбленная кнопка с поясняющим текстом — конкретная
верстка не архитектурная развилка, решается при реализации по образцу
уже существующего блока). CHECKIN не имеет условия недоступности
(`120.txt`, «Меню»).

## `src/router/index.js`

Записи `/scanner` (`name: 'Scanner'`) и `/scanner-prototype`
(`name: 'ScannerPrototype'`) удаляются. Добавляются три записи по тому
же образцу (`meta: { requiresAuth: true, requiresAdmin: false }`,
lazy `component: () => import(...)`):

| Path | Name | Компонент |
|---|---|---|
| `/scanner/bus` | `ScannerBus` | `ScannerBusView.vue` |
| `/scanner/group` | `ScannerGroup` | `ScannerGroupView.vue` |
| `/scanner/checkin` | `ScannerCheckin` | `ScannerCheckinView.vue` |

# Новые компоненты

## `src/composables/useScanPacket.js`

Единственное место, где реализована сборка/отправка `PresencePacket` —
все три режима используют его, а не дублируют логику в каждом View
(следование слоистой конвенции проекта). Отвечает и за бизнес-логику
пакета, и за сам вызов `submit-scan-packet` (по аналогии с тем, что
другие composables проекта сами обращаются к Supabase — здесь тем же
образом инкапсулируется обращение к Edge Function; вынесение сетевого
вызова из View сюда — не архитектурная прихоть, а устранение
трёхкратного дублирования кода вызова, который иначе пришлось бы
повторить в каждом из трёх View по образцу `InviteGeneratorView.vue`).

Предлагаемая форма API (сигнатуры, не реализация):

| Функция | Назначение |
|---|---|
| `createPacket(type, context)` | Инициализирует пустой пакет: новый `client_packet_id` (`crypto.randomUUID()`), `type`, `date` (сегодня), `author_id` из `userStore.userInfo.id`, `bus_id`/`group_id` из `context` (по типу). `started_at`/`finished_at` — `null` до первого добавления/до отправки. |
| `isDuplicate(childId)` | Есть ли уже такой `child_id` в `packet.children`. |
| `addScanned(child)` | Если не дубликат — добавляет `{ child_id, timestamp: now, method: 'SCAN' }`; фиксирует `started_at`, если это первая запись. Дубликат — no-op (сигнал «уже отсканирован» формирует вызывающий View через override `onChildResolved`, не этот composable). |
| `addManual(child)` | Только для GROUP: то же самое с `method: 'MANUAL'`. Повторный тап по уже найденному в ростере — no-op (не снимает отметку — в `120.txt` нет операции «отменить ручную отметку»). |
| `resetPacket()` | Отбрасывает текущий пакет, вызывает `createPacket()` заново с новым `client_packet_id`. |
| `submitPacket()` | Фиксирует `finished_at`, выполняет `fetch()` к `submit-scan-packet` (см. «API изменения»). Успех → состояние `sent` (View решает, что делать дальше — обычно `resetPacket()`). Ошибка → состояние `error` с сообщением, **пакет и `client_packet_id` не изменяются** — повторный вызов `submitPacket()` переотправляет тот же объект. |

Внутреннее состояние: `packet` (reactive), `status`
(`'idle'|'sending'|'sent'|'error'`), `errorMessage`. Существует только
в памяти текущего экземпляра composable — не пишется в
`localStorage`/LocalForage (`120.txt`, «Логика работы», сознательное
ограничение).

## `src/views/ScannerBusView.vue`

Монтирует `<Scanner :onChildResolved="handleResolved" />` +
`useScanPacket()` с `createPacket('BUS', { bus_id: userStore.userInfo.bus_id })`
при монтировании. `handleResolved`: `result.status !== 'found'` →
`undefined` (стандартный экран `Scanner.vue`); иначе —
`isDuplicate` → override «уже отсканирован» (`variant:'success', repeat:true`,
по образцу `ScannerPrototypeView.vue`); иначе `addScanned(result.child)`,
`undefined` (стандартный экран успеха). UI — по мокапу `120.txt`:
счётчик, последний найденный, кнопки `[Reset] [Отправить]`, под ними
полный список без дублей.

## `src/views/ScannerGroupView.vue`

Дополнительно к паттерну BUS: при монтировании параллельно с
`createPacket('GROUP', { group_id: userStore.userInfo.group_id })`
загружает ростер через
`useArmband().getChildrenByGroupOrderedById(userStore.userInfo.group_id)`.
UI — чек-лист (найден/не найден по `isDuplicate(child.id)` после
скана), счётчик `N / Total`, тап по ненайденному в списке →
`addManual(child)`. Скан резолвит `Scanner.vue` независимо от того,
из этой ли группы ребёнок — `120.txt` не описывает отдельной проверки
принадлежности группе для GROUP-режима (в отличие от явного запрета
такой фильтрации для BUS/CHECKIN); поведение при сканировании ребёнка
не из текущей группы — открытый вопрос, см. «Риски».

## `src/views/ScannerCheckinView.vue`

Структурно ближе всего к BUS (без ростера, без ручной отметки), но
список строится сразу (не под кнопками) и каждая строка показывает
группу ребёнка (`child.group_id`, уже приходит в `result.child` от
`Scanner.vue`) — по мокапу `120.txt`. `createPacket('CHECKIN', {})` —
без `bus_id`/`group_id` в контексте.

**Почему три отдельных View, а не один параметризуемый компонент**:
BUS и CHECKIN похожи, но не идентичны (разное расположение списка,
разный набор колонок в строке, разный заголовок), GROUP качественно
отличается (ростер + чек-лист + ручная отметка). Общая часть уже
вынесена — `Scanner.vue` (сканирование) и `useScanPacket.js` (сборка/
отправка пакета); оставшаяся разница — исключительно в разметке и
порядке элементов каждого экрана, где искусственное объединение в один
компонент с ветвлением по `mode` увеличило бы сложность шаблона без
сокращения реального дублирования кода.

# Изменения БД

Нет. Схема, миграции, серверные функции — целиком в объёме тикета 122
(`tickets/122/IMPLEMENTATION_PLAN.md`).

# API изменения

120 не реализует и не изменяет ни одного серверного API — только
впервые начинает **реально вызывать** Edge Function
`submit-scan-packet`, чья реализация принадлежит тикету 122. Ниже —
контракт запроса, обязательный для клиента 120 (совпадает буква в
букву с `tickets/122/IMPLEMENTATION_PLAN.md`, разделы «API изменения»;
воспроизведён здесь как обязательный к реализации на стороне клиента,
не повторное решение):

```
POST {VITE_SUPABASE_URL с .co → .co/functions/v1}/submit-scan-packet
Headers:
  Content-Type: application/json
  Authorization: Bearer <session.access_token>
  apikey: <VITE_SUPABASE_KEY>
```

Тело запроса:

| Поле | Обязательность |
|---|---|
| `client_packet_id` (uuid) | всегда |
| `type` (`'BUS'\|'GROUP'\|'CHECKIN'`) | всегда |
| `date` (`'YYYY-MM-DD'`) | всегда |
| `author_id` | всегда заполняется клиентом, сервер значение игнорирует |
| `started_at`, `finished_at` (ISO timestamp) | всегда |
| `bus_id` | при `type='BUS'` |
| `group_id` | при `type='GROUP'` |
| `children[].child_id` | всегда, для каждого элемента |
| `children[].timestamp` (ISO) | всегда |
| `children[].method` (`'SCAN'\|'MANUAL'`) | всегда |

Ответ: `200 { packet_id, status: 'created'|'duplicate' }` — оба случая
клиент трактует как успех (в т.ч. `'duplicate'` — результат повтора
после сети, уже описано в `120.txt`, «Идемпотентность — забота
сервера»). Ошибка — `400/401/403/500` со структурированным телом
(формат по образцу существующих функций, например `{ error: string }`)
→ клиент показывает сообщение с кнопкой «Повторить», не изменяя
`client_packet_id`.

# UI изменения

- `MainView.vue` — три новые кнопки вместо «Scannen»/ссылки на
  прототип (см. «Изменения существующих компонентов»).
- Три новых экрана (`/scanner/bus`, `/scanner/group`, `/scanner/checkin`) —
  раскладка по образцу `Scanner.vue`/`ScannerPrototypeView.vue`: камера
  сверху, под ней — область режима (счётчик/список/ростер), кнопки
  `[Reset] [Отправить]`, точный вид каждого экрана — по мокапам
  `120.txt`, раздел «Экраны режимов».
- Удаляются экраны `ScannerView.vue`, `ScannerPrototypeView.vue`
  целиком (не архивируются).
- `AdminBusView.vue` — без изменений (подтверждено `120.txt` и планом
  122).

# План реализации

1. `useArmband.js` — удалить `recordChildPresence()`, добавить
   `getChildrenByGroupOrderedById()`. Независимый первый шаг.
2. `useScanPacket.js` — сборка пакета + вызов `submit-scan-packet`.
   Зависит от контракта из раздела «API изменения» (уже зафиксирован,
   реализация Edge Function — тикет 122, может отставать по времени;
   на период параллельной разработки допустима работа против мока
   эндпоинта, `120.txt`, «Границы задачи»). Не зависит от шага 1.
3. `ScannerBusView.vue` — зависит от шага 2 (не от шага 1 — не
   использует ростер).
4. `ScannerCheckinView.vue` — зависит от шага 2, независим от шага 3
   (можно параллельно).
5. `ScannerGroupView.vue` — зависит от шагов 1 и 2 (единственный,
   использующий ростер и ручную отметку) — самый сложный экран,
   разумно делать последним из трёх.
6. `router/index.js` — три новых маршрута, удаление `/scanner` и
   `/scanner-prototype`. Зависит от шагов 3-5 (нужны готовые
   компоненты для монтирования).
7. `MainView.vue` — новые кнопки/условия доступности, удаление старых
   обработчиков. Зависит от шага 6 (нужны существующие маршруты).
8. Удалить `src/views/ScannerView.vue` и
   `src/views/ScannerPrototypeView.vue` из кодовой базы. После шага 7
   (когда на них не осталось ссылок ни из роутера, ни из меню).
9. Сквозная ручная проверка на реальных Android/iPhone-устройствах
   (см. «Definition of Done» — как в `120.txt`) — после интеграции с
   реально задеплоенной Edge Function из тикета 122, не против мока.

# Риски

- **Рассинхронизация контракта с тикетом 122.** Формат `PresencePacket`
  зафиксирован в трёх документах (`120.txt`, план 121, план 122) и
  здесь ещё раз воспроизведён дословно — риск того же рода, что уже
  явно назван в `tickets/122/IMPLEMENTATION_PLAN.md` («Риски»);
  снижается требованием одновременного релиза 120/122 и сквозной
  проверкой на шаге 9, но не устраняется архитектурно.
- **Копипаста фильтра по группе в BUS/CHECKIN.** Явно предупреждено
  `120.txt` — при написании `handleResolved` для этих двух режимов по
  образцу GROUP легко случайно скопировать проверку
  `child.group_id === context.group_id`, которой там быть не должно.
- **Скан ребёнка не из текущей группы в GROUP-режиме — не описано
  `120.txt`.** Открытый вопрос: добавлять ли такого ребёнка в пакет
  (он не в ростере, чек-лист не обновится для него, но запись в пакете
  формально корректна) или отклонять с отдельным сигналом. Нужно явное
  решение перед реализацией `ScannerGroupView.vue` (шаг 5) — не
  архитектурная развилка уровня всего тикета, но зафиксировать ответ
  стоит до написания кода, а не по ходу.
- **Пакет только в памяти — потеря при перезапуске приложения
  посреди захода.** Сознательное ограничение `120.txt`, не смягчается
  этим тикетом (обсуждалось и принято на уровне требований, не
  архитектурное упущение).
- **Путаница `scans.type` vs `PresencePacket.type`/`scan_packets.type`.**
  Разные по смыслу поля с похожими именами в разных слоях (клиентский
  пакет / будущая серверная таблица 122 / устаревшее поле `scans`) —
  риск не для 120 напрямую (120 не пишет в `scans.type`), но стоит
  держать в уме при совместной проверке с 122.
- **iOS Safari mute switch / ограничения Web Audio** — унаследованный
  от 103/116 риск, не решается в этом тикете; экран подтверждения
  `Scanner.vue` остаётся надёжным каналом обратной связи независимо от
  звука.
- **Удаление `/scanner` и `/scanner-prototype`** — если у кого-то есть
  сохранённая ссылка/ярлык PWA на старый маршрут, переход по нему
  после этого тикета приведёт к 404/редиректу. Внутреннее приложение
  с малым числом пользователей — риск принят, отдельная миграция
  ссылок не требуется.

# Definition of Done

Совпадает по существу с `120.txt`, раздел «Definition of Done»; здесь
— как контрольный список для архитектурной готовности к реализации:

- `useScanPacket.js` реализован и покрывает все три режима без
  дублирования логики сборки/отправки пакета в самих View.
- `useArmband.recordChildPresence()` удалён, вызывающих в `src/` не
  осталось; `getChildrenByGroupOrderedById()` добавлен, существующий
  `getChildrenByGroup()` не изменён (регрессия по `ArmbandView.vue`
  исключена).
- Три маршрута (`/scanner/bus`, `/scanner/group`, `/scanner/checkin`)
  реализованы через отдельные View, реиспользующие `Scanner.vue`
  без изменений; `/scanner` и `/scanner-prototype` удалены из роутера,
  `ScannerView.vue`/`ScannerPrototypeView.vue` удалены из кодовой базы.
- `MainView.vue` показывает три новые кнопки с условиями доступности
  по `bus_id`/`group_id`; старые кнопка/обработчики удалены.
- Кнопка «Отправить» во всех трёх режимах выполняет реальный запрос к
  `submit-scan-packet` по контракту раздела «API изменения»; ошибка
  сохраняет `client_packet_id` и предлагает повтор; успех очищает
  локальный пакет.
- `AdminBusView.vue`, `useScan.js`, `ChildDetailView.vue` не изменены.
- Открытый вопрос «скан не из текущей группы в GROUP-режиме» (раздел
  «Риски») разрешён явным решением до или в процессе шага 5 плана
  реализации.
  **Ответ** 
  >>>
  Если при групповой перекличке был отсканирован ребенок, который не относится к текущей группе, это считается ошибкой.

Важно разделять два этапа обработки:

Сканер успешно считывает браслет и определяет ребенка. Для него операция выполнена успешно.
Режим "Перекличка группы" проверяет, принадлежит ли ребенок текущей группе. Если ребенок относится к другой группе, возникает ошибка бизнес-логики.

В этом случае ребенок не должен добавляться в список текущей группы. Пользователю необходимо вывести понятное сообщение, например:

Ребенок не относится к текущей группе.

или

Невозможно отметить ребенка: выбрана другая группа.

Таким образом, ошибка связана не со сканированием браслета, а с тем, что ребенок не соответствует выбранному режиму работы сканера. Это различие важно сохранить как в архитектуре системы, так и в пользовательском интерфейсе.
<<<
- Ручная проверка на реальных Android- и iPhone-устройствах выполнена
  для всех трёх режимов против реально задеплоенной (не мок)
  `submit-scan-packet`.

