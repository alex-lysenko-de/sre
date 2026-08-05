# Ticket 151 — Architekturplan: Zusammenführung `ChildDetailView.vue` / `ChildCardView.vue`

# Цель

Устранить дублирование двух почти идентичных экранов просмотра ребёнка:

- `ChildDetailView.vue` (`/child/:id`, `ChildDetail`) — общий экран
  «карточка ребёнка» (доступен и Betreuer, и admin: `requiresAdmin: false`).
- `ChildCardView.vue` (`/admin/checkpoints/child/:id`, `CheckpointChildCard`)
  — экран, встроенный в раздел Checkpoint (только admin).

Каждый экран должен получить единственную, не пересекающуюся с другим
ответственность (принцип из `vault/02-Предметная-область/Checkpoint.md`,
«Каждая сущность имеет собственный экран»):

- `/child/:id` — **карточка ребёнка**: статичные данные + баннер
  присутствия сегодня + действия управления (Bearbeiten/Entfernen) +
  переход к истории Checkpoint для admin.
- `/admin/checkpoints/child/:id` — **список ScanEvent ребёнка за
  сегодня** в контексте Checkpoint, без дублирования карточки ребёнка.

Плюс: унифицировать навигацию «Zurück» (реальный предыдущий экран, не
жёстко заданный маршрут) и стиль/расположение кнопок (компактная
«Zurück», увеличенные кнопки действий, компактная «Entfernen») по
образцу уже принятого в проекте стиля `CheckpointBusView.vue`
(тикет 134/140).

# Анализ текущей архитектуры

Слоистая модель проекта (`stores` → `composables/useXXX` →
`composables/useSupabaseXXX`) для этой пары экранов упрощена — оба View
обращаются напрямую к бизнес-composables (`useArmband`, `useScan`,
`useChildren`), без отдельного store. Это уже сложившийся паттерн для
Child-домена (см. `ChildEditView.vue`, `GroupEditView.vue`), трогать его
не требуется.

**`ChildDetailView.vue`** (текущее состояние, `src/views/ChildDetailView.vue`):

- Данные: `useArmband().getChildDetails(childId)` — сырая строка
  `children.*` (snake_case: `group_id`, `band_id`, ...).
- Присутствие сегодня: `useScan().isChildPresentToday()` +
  `getChildBusForToday()` → `presenceInfo` (баннер).
- Действия: `editChild()` → `router.push({ name: 'ChildDetailEdit' })`;
  `removeChild()` → `useChildren().deleteChild()` + `confirm()`, ошибка
  удаления отображается in-place (`deleteError`, без замены карточки —
  фикс ревью тикета 142), редирект на `GroupEdit`.
- `goBack()` → жёстко `router.push('/main')` — баг, требуемый к
  исправлению.
- Кнопки — широкие (`.d-grid.gap-2`, `btn-lg`), не разделены визуально
  по значимости.
- Истории сканов нет.

**`ChildCardView.vue`** (текущее состояние, `src/views/ChildCardView.vue`):

- Данные: `useChildren().getChildById(id)` — нормализованная форма
  (camelCase: `groupId`, `busId`; см. `useChildren.js:123-147`).
- История сканов: `useChildren().fetchChildDetailsAndScans(childId)`
  (`useChildren.js:199-229`) — **без фильтра по дате**, только
  `order('created_at', desc).limit(50)`; используется **только** этим
  экраном (проверено грепом по всему `src/`) — безопасно менять сигнатуру.
- Уже нужный стиль: компактная круглая `.cp-back-btn` +
  `router.back()`, инфо-грид `.cp-info-grid`/`.cp-info-item`, карточки
  `card`/`card-body`.
- Кнопки: только «Bearbeiten» (в шапке, `.cp-edit-btn`) — «Entfernen»
  нет вообще.
- Нет баннера присутствия сегодня.

**Точки входа на `/child/:id`** (все остаются корректными, не меняются):
`ArmbandView.vue:153,211`, `ChildEditView.vue:255`,
`GroupEditView.vue:172` — все уже используют `router.push({ name:
'ChildDetail', ... })`.

**Точки входа на `/admin/checkpoints/child/:id`** — единственная:
`ChildLink.vue:5` (`$router.push(\`/admin/checkpoints/child/${child.id}\`)`),
используется в `EntityListCard.vue` (→ `EntityListView.vue`,
`/admin/checkpoints/list`) и напрямую в `CheckpointLazyView.vue`
(строки 88, 109). Других мест, ссылающихся на этот маршрут, в `src/`
нет (грепом подтверждено) — значит правку из требования №3 достаточно
внести **в одном месте**, `ChildLink.vue`.

**Переиспользуемый готовый композабл для today-фильтра сканов** —
уже существует и не требует новой логики:
`useScan().getChildScansForDate(childId, date = null)`
(`useScan.js:79-97`) — `SELECT id, created_at, bus_id, type, user_id,
band_id FROM scans WHERE child_id = ? AND date = <today> ORDER BY
created_at DESC`, `date` по умолчанию — `getTodayDate()` (тот же
формат `YYYY-MM-DD`, что и `scans.date` и `Utils.getCurrentDateString()`
— все три построены одинаково: `new Date().toISOString().split('T')[0]`).
Этот композабл уже используется в этом же файле для баннера присутствия
(`isChildPresentToday`/`getChildBusForToday`) — то есть заменить
`fetchChildDetailsAndScans()` на него в `ChildCardView.vue` естественно
и не требует новой БД-логики.

**Роль GroupLink.vue — важное ограничение.** `GroupLink.vue`
(используется в текущем `ChildCardView.vue` для отображения группы)
ведёт на `/admin/checkpoints/group-entity/:id`, маршрут с
`requiresAdmin: true`. `/child/:id` же доступен и не-admin Betreuer
(`requiresAdmin: false`). Поэтому **`GroupLink` нельзя использовать
в объединённом `/child/:id` без проверки роли** — иначе рядовой
Betreuer получит кликабельную ссылку, ведущую на экран, откуда его
тут же завернёт `router.beforeEach`. Требование тикета этого не просит
— группа в `/child/:id` остаётся простым текстом (`Gruppe {{
child.groupId }}`), как сейчас в `ChildDetailView.vue`.

# Затрагиваемые модули

| Файл | Тип изменения |
|---|---|
| `src/views/ChildDetailView.vue` | Существенная переработка (шаблон + стили + источник данных) |
| `src/views/ChildCardView.vue` | Урезание (убрать инфо о ребёнке и Bearbeiten, добавить today-фильтр истории) |
| `src/components/checkpoints/ChildLink.vue` | Точечное изменение целевого маршрута |
| `src/composables/useChildren.js` | Опционально: `fetchChildDetailsAndScans()` становится мёртвым кодом (см. «Риски») |
| `src/router/index.js` | Без изменений (оба маршрута уже существуют и корректны) |
| `vault/06-Маршруты-и-URL/Карта-маршрутов.md`, `vault/02-Предметная-область/Checkpoint.md` (если там есть ссылки на функциональность этих экранов) | Обновление документации после реализации (вне охвата архитектурного плана, но отметить в DoD) |

Не затрагиваются: `ArmbandView.vue`, `ChildEditView.vue`,
`GroupEditView.vue` (их переходы на `ChildDetail` уже корректны),
`EntityListCard.vue`, `EntityListView.vue`, `CheckpointLazyView.vue`
(меняется только используемый ими `ChildLink.vue`, сами файлы — нет),
БД/схема (используются только существующие таблицы/колонки).

# Изменения существующих компонентов

## `ChildDetailView.vue` (`/child/:id`, доступен Betreuer + admin)

Остаётся «карточкой ребёнка» с полной статичной информацией — но со
стилем/структурой шапки и кнопок, заимствованными из
`ChildCardView.vue`/`CheckpointBusView.vue`:

1. **Источник данных** — заменить `useArmband().getChildDetails()` на
   `useChildren().getChildById()` (композабл уже импортирован в файле
   ради `deleteChild()`). Убирает лишнюю зависимость от `useArmband` в
   этом экране и приводит имена полей к единому виду (`child.groupId`
   вместо `child.group_id` и т.п.), единообразно с `ChildCardView.vue`.
2. **Шапка** — по образцу `.cp-header`/`.cp-header-top` из
   `CheckpointBusView.vue`/`ChildCardView.vue`: компактная круглая
   кнопка «Zurück» (`.cp-back-btn`, иконка `arrow-left`) слева,
   заголовок — имя ребёнка.
3. **`goBack()`** — заменить `router.push('/main')` на `router.back()`.
4. **Баннер присутствия** (`presenceInfo`) — логика не меняется
   (`useScan().isChildPresentToday()`/`getChildBusForToday()`).
5. **Новая кнопка «Checkpoints anzeigen»** — сразу под баннером
   присутствия, видна только при `userStore.isAdmin` (паттерн
   `v-if="userStore.isAdmin"`, как в `MainView.vue:60`). По клику —
   `router.push({ name: 'CheckpointChildCard', params: { id:
   child.id } })`.
6. **Инфо-грид** (Alter/Gruppe/Schwimmabzeichen/Armband/Notizen) —
   переносится на классы `.cp-info-grid`/`.cp-info-item` (взять из
   `ChildCardView.vue`, шире переиспользовать как есть). Группа —
   **текстом**, не через `GroupLink` (см. «Анализ», ограничение по
   ролям).
7. **Кнопки действий** — «Bearbeiten» остаётся крупной с увеличенными
   отступами/паддингом (по требованию — не как узкая `btn-lg` вплотную
   к «Entfernen», а с явным зазором). «Entfernen» — компактная кнопка
   в стиле `.cp-remove-btn` (маленькая иконка-кнопка, не на всю
   ширину) — уменьшает риск случайного нажатия, как явно того требует
   тикет. Логика `removeChild()`/`isDeleting`/`deleteError`
   (реализована и исправлена тикетом 142) переносится без изменений.
8. Импорт `useArmband`/`useScan(createScan)` — оставить только то, что
   реально используется (`useScan` нужен для presence-баннера,
   `useArmband` — убрать, если после смены источника данных больше
   нигде в файле не используется).

## `ChildCardView.vue` (`/admin/checkpoints/child/:id`, только admin)

Становится тонким «списком ScanEvent за сегодня» для Checkpoint-контекста:

1. **Убрать инфо-грид ребёнка целиком** (`.cp-info-grid` блок:
   Alter/Gruppe/Schwimmabzeichen/Armband/Notizen) — теперь это зона
   ответственности `/child/:id`.
2. **Убрать кнопку «Bearbeiten»** из шапки (`.cp-edit-btn`,
   `editChild()`) — управление ребёнком (редактирование/удаление)
   теперь целиком на `/child/:id`; здесь остаётся только просмотр.
3. **Шапка** — оставить как есть (`.cp-back-btn` + заголовок с именем
   ребёнка); `goBack()` уже правильно использует `router.back()` —
   не менять.
4. **История сканов** — заменить источник:
   `useChildren().fetchChildDetailsAndScans(childId)` →
   `useScan().getChildScansForDate(childId)` (без даты — берёт
   `getTodayDate()` по умолчанию, т.е. только сегодня). Карту
   `scanTypeMap`/сборку `resultLabel`/интеграцию с
   `getBetreuerByIds()` (по `user_id` из возвращаемых записей —
   совместимо) — перенести из текущей реализации
   `fetchChildDetailsAndScans` (уже есть, просто источник записей
   меняется).
5. `useChildren().getChildById()` — остаётся (нужен для заголовка
   `{{ child?.name }}`), `getChildDetails/watch(route.params.id, load)`
   без изменений.

## `ChildLink.vue`

Изменить единственную строку — целевой путь перехода:
`/admin/checkpoints/child/${child.id}` → `/child/${child.id}`
(или именованный маршрут `ChildDetail`). Затрагивает оба текущих
потребителя (`EntityListCard.vue`/`EntityListView.vue`,
`CheckpointLazyView.vue`) без изменений в них самих — реализует
требование №3 («все страницы на `/admin/checkpoints` ... на самом деле
должны открывать `/child/:id`») в одной точке.

# Новые компоненты

Не требуются. Новая функциональность (кнопка «Checkpoints anzeigen»,
компактная «Entfernen» на объединённом экране) реализуется как
изменения существующих `ChildDetailView.vue`/`ChildCardView.vue` с
переиспользованием уже существующих CSS-классов/паттернов
(`.cp-back-btn`, `.cp-remove-btn`, `.cp-info-grid` — все уже есть в
`CheckpointBusView.vue`/`ChildCardView.vue`) и композаблов
(`useChildren`, `useScan`, `useUserStore`).

# Изменения БД

Не требуются. Используются существующие таблица/колонка
`scans.date` (`character varying`, `YYYY-MM-DD`, уже присутствует в
схеме — `backup/database/schema.sql:4180`) и существующий композабл
`useScan().getChildScansForDate()`, который уже фильтрует по ней.
RLS/RPC не меняются.

# API изменения

Нет изменений в Supabase Edge Functions/RPC. Меняется только то, какой
клиентский композабл вызывается из `ChildCardView.vue` (замена
`useChildren().fetchChildDetailsAndScans()` на уже существующий
`useScan().getChildScansForDate()`) — оба обращаются к таблице `scans`
напрямую через Supabase JS client, доступ не меняется.

# UI изменения

- `/child/:id`: новый визуальный стиль шапки/кнопок (компактная
  «Zurück», увеличенные отступы у «Bearbeiten», компактная
  «Entfernen»), новая кнопка «Checkpoints anzeigen» (только admin) под
  баннером присутствия, инфо-грид на классах `.cp-info-grid`.
- `/admin/checkpoints/child/:id`: экран становится короче — только
  заголовок/«Zurück»/список ScanEvent за сегодня; пропадают
  инфо-грид ребёнка и кнопка «Bearbeiten».
- Ссылки из `EntityListView.vue`/`CheckpointLazyView.vue` на ребёнка
  теперь ведут на `/child/:id` вместо `/admin/checkpoints/child/:id`.
- На `/child/:id` для admin появляется явный переход на
  `/admin/checkpoints/child/:id` (обратная ссылка уже существовала бы
  неявно через «Zurück» после перехода).

# План реализации

1. `ChildLink.vue` — сменить целевой путь на `/child/:id`. Наименее
   рискованный шаг, не зависящий от остальных; можно проверить
   отдельно (клик из `EntityListView`/`CheckpointLazyView` открывает
   `/child/:id`).
2. `ChildDetailView.vue`:
   1. Сменить источник данных `useArmband().getChildDetails()` →
      `useChildren().getChildById()`; убрать неиспользуемый импорт
      `useArmband`, если он больше нигде в файле не нужен.
   2. Заменить `goBack()` на `router.back()`.
   3. Переверстать шапку/инфо-грид/кнопки по стилю
      `ChildCardView.vue`/`CheckpointBusView.vue` (компактная
      «Zurück», крупная «Bearbeiten» с увеличенными отступами,
      компактная «Entfernen»).
   4. Добавить кнопку «Checkpoints anzeigen» (`v-if="userStore.isAdmin"`)
      под баннером присутствия → `router.push({ name:
      'CheckpointChildCard', params: { id: child.id } })`; добавить
      импорт `useUserStore`.
3. `ChildCardView.vue`:
   1. Убрать инфо-грид ребёнка и кнопку «Bearbeiten» из шапки.
   2. Заменить `fetchChildDetailsAndScans()` на
      `useScan().getChildScansForDate()`; перенести маппинг
      `scanTypeMap`/сборку `history` на новый источник записей.
4. Ручная сквозная проверка по критериям приёмки (см. DoD) —
   переходы из всех точек входа, «Zurück» с разных экранов, видимость
   кнопки «Checkpoints anzeigen» для admin/non-admin, фильтр истории
   по сегодняшней дате, работа «Entfernen» на объединённом экране.
5. Обновить `vault/06-Маршруты-и-URL/Карта-маршрутов.md` (описание
   `ChildCardView.vue`/`ChildDetailView.vue` в таблице маршрутов) и,
   при наличии релевантных ссылок, `vault/02-Предметная-область/Checkpoint.md`.

Шаги 2 и 3 независимы друг от друга и от шага 1 (можно реализовывать в
любом порядке/параллельно); шаг 4 требует завершения 1–3; шаг 5 —
финальный.

# Риски

- **`useChildren().fetchChildDetailsAndScans()` станет мёртвым кодом.**
  После шага 3.2 у функции не останется потребителей (грепом
  подтверждено — единственный вызывающий это `ChildCardView.vue`).
  Тикет не просит явно удалять код за пределами двух экранов — решение
  оставлено на реализацию: либо удалить функцию (по прецеденту тикетов
  137/142, где мёртвый код, найденный по ходу работы, удалялся сразу),
  либо оставить с пометкой на будущее. Рекомендация: удалить, зафиксировав
  находку в `IMPLEMENTATION_REPORT.md` (как это делалось ранее).
- **Различие полей `child.group_id` (snake_case, `useArmband`) vs
  `child.groupId` (camelCase, `useChildren`).** При переходе
  `ChildDetailView.vue` на `useChildren().getChildById()` все обращения
  к `child.group_id`/прочим snake_case-полям в шаблоне должны быть
  переименованы согласовано — риск точечных опечаток, закрывается
  обычным ревью/сборкой (`npm run build` не поймает опечатки в
  интерполяции шаблона, только явные синтаксические ошибки — нужна
  визуальная проверка).
- **`GroupLink` в объединённом `/child/:id` — ловушка для не-admin
  пользователей**, если кто-то в процессе реализации решит «раз стиль
  берём из `ChildCardView`, то и `GroupLink` тоже» — так делать нельзя
  (см. «Анализ», ведёт на admin-only маршрут). Явно зафиксировано выше
  как ограничение.
- **`useScan().getChildScansForDate()` не включает `type_name`** —
  маппинг `scanTypeMap` (`{1: 'Präsenz', 2: 'Bus (Einstieg)', 3: 'Bus
  (Ausstieg)'}`) должен быть перенесён в `ChildCardView.vue` вручную
  (сейчас он «зашит» в `useChildren.fetchChildDetailsAndScans`,
  переезжающей в мёртвый код) — при удалении функции не забыть
  сохранить этот маппинг на новом месте.
- **Ручная проверка на устройстве отсутствует в сессии ИИ-ассистента**
  (устойчивый паттерн для всех тикетов проекта, см. `CLAUDE.md`/историю
  тикетов 132-150) — верификация критериев приёмки потребует
  тестирования пользователем после реализации.

# Definition of Done

- `ChildDetailView.vue` (`/child/:id`): «Zurück» — компактная кнопка,
  `router.back()`; «Bearbeiten» — с увеличенными отступами; «Entfernen»
  — компактная, работает с подтверждением (переиспользована текущая
  логика); кнопка «Checkpoints anzeigen» видна только admin и ведёт на
  `/admin/checkpoints/child/:id`.
- `ChildCardView.vue` (`/admin/checkpoints/child/:id`): показывает
  только заголовок, «Zurück» и список ScanEvent **за сегодня**
  (`scans.date` = текущая дата); инфо о ребёнке и «Bearbeiten»
  отсутствуют.
- Все точки входа (`ArmbandView`, `ChildEditView`, `GroupEditView`,
  `ChildLink.vue`/чекпоинт-экраны) открывают `/child/:id`.
- `npm run build` проходит без ошибок.
- `IMPLEMENTATION_REPORT.md` и `REVIEW_REPORT.md` созданы в
  `tickets/151/` по конвенции проекта; `tickets/dashboard.md` обновлён.
- Ручная проверка в браузере/на устройстве — по конвенции проекта
  выполняется пользователем отдельно (см. «Риски»); в отчёте явно
  отмечается как не выполненная средствами ИИ-ассистента.
