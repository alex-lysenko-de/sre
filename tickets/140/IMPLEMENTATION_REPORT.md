# Ticket 140: Отчёт о реализации

Реализовано по плану (`IMPLEMENTATION_PLAN.md`), без отклонений.

## 1. Локализация

Заменены все найденные строки, реально отображаемые в интерфейсе и не на
немецком (обзор показал, что почти весь остальной русский текст в `src/`
— это комментарии/JSDoc, не UI):

- `src/components/scanner/Scanner.vue` — `Cancel` → `Abbrechen`,
  `Привязать бейдж` → `Armband zuordnen`.
- `src/views/ScannerCheckinView.vue`, `src/views/ScannerBusView.vue` —
  `Отсканировано:` → `Gescannt:`, `Close` → `Schließen`.
- `src/views/ScannerGroupView.vue` — `Close` → `Schließen`.
- `src/views/ResetPasswordView.vue`, `src/views/UsersView.vue` —
  `aria-label="Close"` → `aria-label="Schließen"`.

Не тронуты (сознательно, см. план): `Bus`/`Group`/`Lazy` как названия
типов Checkpoint — устоявшаяся доменная терминология, используется
одинаково по всему коду (`CheckpointTypeBadge.vue`,
`CheckpointCreateModal.vue`, заголовки трёх детальных вью).

## 2. `ArmbandView.vue`

- Заголовок: `📍 Armband‑Zuordnung (ID={{ bandId }})`.
- В списке "Kind auswählen": рядом с именем каждого ребёнка добавлена
  строка `— Armband: {{ child.band_id ?? '—' }}`. `band_id` уже
  выбирался в `useArmband.getChildrenByGroup()`, правка только в
  шаблоне.

`ArmbandConnectView.vue`/маршрут `ArmbandConnect` не тронуты — это
недописанная заглушка (только TODO-комментарии), на которую нигде в коде
нет перехода (`router.push`/`router-link`); 140.txt говорит о странице
"Armband-zuordnen", это реальная `ArmbandView.vue` (маршрут `Armband`).

## 3-4. Виджет Checkpoint

### Общие компоненты (правка один раз — применяется сразу в списке и во
    всех трёх детальных вью)

- **`CheckpointOriginBadge.vue`**: убран `class="badge ..."`, теперь
  обычная строка `Ersteller: <b>...</b>`. Убрана веточка с
  захардкоженным текстом `Admin` — теперь безусловный
  `<BetreuerLink :betreuer="createdBy" />`, который уже сам отличает
  админа (статичный текст с именем) от обычного Betreuer (кликабельная
  ссылка). Создатель теперь всегда показывается по имени, включая
  hauptbetreuer.
- **`CheckpointStatusBadge.vue`**: основной статус (`Offen`/
  `Geschlossen`) — тоже обычный текст `Status: <b>...</b>`, цвет теперь
  только на слове (зелёный/серый), без фона-пилюли. Бейджи
  "Überfällig"/"Anomalie: mehrere offen" оставлены как есть — в 140.txt
  не названы, это предупреждения, а не статус, с кнопкой не путаются.

### `CheckpointListView.vue`

Порядок внутри карточки: время → строка "Ersteller" → строка "Status" →
footer (только delta/anomaly, без бейджей) → `cp-item-result` в самом
низу карточки. `cp-item-result` увеличен (1.25rem → 1.6rem), добавлен
разделитель (`border-top`); убраны переопределения цвета для закрытых
карточек (`.cp-item-card-closed .cp-item-stat-kinder/betreuer`) и добавлен
явный цвет для `.cp-item-stat-present` (раньше наследовал блёклый цвет
закрытой карточки) — результат теперь одинаково заметен для открытых и
закрытых checkpoint'ов.

### `CheckpointBusView.vue` / `CheckpointGroupView.vue` /
    `CheckpointLazyView.vue`

Одинаковая правка во всех трёх: порядок в `.cp-header` был
status-row → result-row → actionError → origin-line, стал
origin-line → status-row → actionError → result-row (перемещён в самый
низ). Добавлен класс `cp-result-row-final` с `:deep()`-переопределением
размера чисел/подписей внутри переиспользуемого `CountLink.vue` (сам
`CountLink.vue` не менялся — он используется и в других местах тех же
страниц, где увеличение не нужно).

## Проверка

- `npm run build` — проходит без ошибок (предупреждение про размер
  чанка `index-*.js` — не новое, не связано с этим тикетом).
- Проверка на устройстве/в браузере — **не выполнена** в этой сессии
  (нет доступа к браузеру/устройству), как и в предыдущих тикетах серии.
