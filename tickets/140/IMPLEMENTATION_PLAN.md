# Ticket 140: План реализации

Небольшой клиентский тикет, 4 независимых части. Ни новых composables, ни
изменений БД/Edge Functions не требуется — везде правки существующих
`.vue`-файлов.

## 1. Локализация (не полная, а точечная)

Обзор кода показал, что UI приложения **уже почти полностью на немецком** —
русские вхождения в `src/` почти все находятся в комментариях/JSDoc (не
показываются в интерфейсе), а строки `type: 'Group'`/`'Lazy'`/"GROUP
Checkpoint" и т.п. — это устоявшаяся доменная терминология типов
Checkpoint (`CheckpointTypeBadge.vue`, `CheckpointCreateModal.vue`,
заголовки `CheckpointBusView.vue`/`CheckpointGroupView.vue`/
`CheckpointLazyView.vue`), используемая одинаково по всему коду — трогать
не буду, это не "случайная" русская/английская строка, а часть уже принятой
терминологии (см. [[feedback-checkpoint-terminology]] в памяти: не
переименовывать устоявшиеся идентификаторы без явного запроса).

Реально найденные строки, отображаемые в интерфейсе и не на немецком:

- `src/components/scanner/Scanner.vue:43` — кнопка `Cancel` → `Abbrechen`.
- `src/components/scanner/Scanner.vue:46` — кнопка `Привязать бейдж` →
  `Armband zuordnen` (совпадает с формулировкой на самой странице
  ArmbandView.vue, куда ведёт `onBindRequested`).
- `src/views/ScannerCheckinView.vue:17` и `src/views/ScannerBusView.vue:15`
  — `Отсканировано:` → `Gescannt:`.
- `src/views/ScannerCheckinView.vue:30`, `src/views/ScannerBusView.vue:28`,
  `src/views/ScannerGroupView.vue:58` — кнопка `Close` → `Schließen`.
- `src/views/ResetPasswordView.vue`, `src/views/UsersView.vue` —
  `aria-label="Close"` на кнопке закрытия alert’а → `aria-label="Schließen"`
  (доступность — тоже часть интерфейса).

## 2. `ArmbandView.vue` (маршрут `Armband`, реальная страница
   Armband-Zuordnung — не путать с неиспользуемым нигде
   `ArmbandConnectView.vue`/`ArmbandConnect`, который остаётся
   TODO-заглушкой без единого перехода на него и не упомянут в 140.txt)

- Заголовок `📍 Armband‑Zuordnung` → добавить ID:
  `📍 Armband‑Zuordnung (ID={{ bandId }})`.
- В списке "Kind auswählen" рядом с именем каждого ребёнка показывать
  `child.band_id` (уже выбирается в `useArmband.getChildrenByGroup()`,
  правка не нужна) или `—`, если не привязан.

## 3-4. Виджет Checkpoint — переработка внешнего вида (список + все 3
   детальных экрана)

`cp-origin-badge` и `cp-status-badge` — общие компоненты
(`CheckpointOriginBadge.vue`/`CheckpointStatusBadge.vue`), используемые
и в `CheckpointListView.vue`, и во всех трёх детальных вью
(Bus/Group/Lazy). Меняю **сами компоненты** — правка применяется сразу
везде, отдельно правки в детальных вью не нужны для самого вида бейджей,
только для порядка блоков.

- **`CheckpointOriginBadge.vue`**: убрать `class="badge ..."`, вернуть
  обычную строку `Ersteller: <b>...</b>`. Убрать веточку с захардкоженным
  `Admin` — `checkpoint.created_by` уже всегда содержит `.name`
  (`useCheckpoints.js:58`, `row.display_name`), поэтому вместо
  `v-if="createdBy?.isAdmin"` показывать `Admin` — использовать
  `<BetreuerLink :betreuer="createdBy" />` безусловно: он уже сам
  отличает админа (статичный текст с именем) от обычного Betreuer
  (кликабельная ссылка) — именно то поведение, которое нужно.
- **`CheckpointStatusBadge.vue`**: убрать `class="badge ..."` у основного
  статуса, заменить на строку `Status: <b>Offen</b>`/`<b>Geschlossen</b>`
  (цвет — на самом `<b>`, без фона-пилюли). "Überfällig"/"Anomalie:..."
  — отдельные предупреждения, в 140.txt явно не названы (там названы
  только `cp-origin-badge`/`cp-status-badge`), оставляю как есть
  (bootstrap-бейдж уместен для предупреждения, не путается с кнопкой).

### `CheckpointListView.vue`

Порядок внутри карточки меняется на: время → (новая) строка Ersteller →
(новая) строка Status → footer (delta/anomaly, без бейджей) →
`cp-item-result` в самом низу карточки. `cp-item-result` увеличивается
(шрифт чисел с 1.25rem до ~1.6rem) и перестаёт тускнеть для закрытых
карточек — убираю переопределения цвета `.cp-item-card-closed
.cp-item-stat-kinder/betreuer`, добавляю явный цвет `.cp-item-stat-present`
(иначе наследует блёклый `color` карточки).

### `CheckpointBusView.vue` / `CheckpointGroupView.vue` /
    `CheckpointLazyView.vue`

Внутри `.cp-header` одинаковый порядок блоков сейчас: status-row →
result-row → actionError → origin-line. Меняю на: origin-line → status-row
→ actionError → result-row (перемещается в самый низ `.cp-header`,
перед последующими карточками страницы). Result-row визуально усиливается
через `:deep()` на числа `CountLink` внутри новой обёртки (сам `CountLink`
не трогаю — он переиспользуется и в других строках той же страницы, где
увеличение не нужно).

## Что не входит

- `ArmbandConnectView.vue` — недописанная, никем не используемая
  заглушка (ни один `router.push`/`router-link` не ссылается на
  `ArmbandConnect`); 140.txt говорит о странице "Armband-zuordnen", это
  `ArmbandView.vue`.
- Переименование `Bus`/`Group`/`Lazy` как названий типов Checkpoint —
  устоявшаяся терминология, не "случайная" русская/английская строка.
- "Überfällig"/"Anomalie: mehrere offen" бейджи — не названы в 140.txt.
- Полный проход по всей кодовой базе на предмет любых английских слов
  (напр. "OK", "Info") — они уже используются в немецком UI как есть
  (в т.ч. в неизменённых до этого тикета местах) и не создают путаницы.

## Definition of Done

- Все перечисленные строки заменены, кнопка "Привязать бейдж"/"Cancel"
  переведена.
- `ArmbandView.vue` показывает ID браслета в заголовке и напротив каждого
  ребёнка в списке.
- `cp-origin-badge`/`cp-status-badge` — обычный текст без квадратов/пилюль,
  создатель всегда показывает имя (не "Admin").
- `cp-item-result`/`cp-result-row` — внизу виджета, крупнее, не тускнеет
  для закрытых.
- `npm run build` проходит.
- Проверка на устройстве — **не выполняется** в этой сессии (нет доступа
  к браузеру/устройству), как и в предыдущих тикетах серии.
