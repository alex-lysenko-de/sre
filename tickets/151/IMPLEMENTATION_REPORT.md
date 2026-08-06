# Измененные файлы

- `src/views/ChildDetailView.vue` (`/child/:id`, `ChildDetail`)
- `src/views/ChildCardView.vue` (`/admin/checkpoints/child/:id`, `CheckpointChildCard`)
- `src/components/checkpoints/ChildLink.vue`
- `src/composables/useChildren.js`

# Новые файлы

Отсутствуют.

# Реализованные изменения

## `ChildDetailView.vue` (`/child/:id`) — объединённая карточка ребёнка

- Верстка и стиль полностью переведены на паттерн `ChildCardView.vue` /
  `CheckpointBusView.vue` (`.cp-header`, `.cp-header-top`, `.cp-back-btn`,
  `.cp-info-grid`/`.cp-info-item`).
- Источник данных сменён с `useArmband().getChildDetails()` на
  `useChildren().getChildById()` (camelCase-форма: `child.groupId`
  вместо `child.group_id`); импорт `useArmband` удалён из файла,
  `removeChild()` соответственно использует `child.value.groupId`.
- `goBack()` заменён с `router.push('/main')` на `router.back()`.
- Кнопка "Zurück" — компактная круглая иконка-кнопка (`.cp-back-btn`)
  вверху слева, как в `CheckpointBusView.vue`.
- Кнопка "Entfernen" вынесена в шапку как компактная иконка-кнопка
  (`.cp-remove-btn`, стиль как `CheckpointBusView.vue`/
  `CheckpointGroupView.vue`/`CheckpointLazyView.vue`) — сохранена вся
  существующая логика (`removeChild()`, `confirm()`, `isDeleting`,
  `deleteError` отображается in-place, без замены карточки — как было
  исправлено в тикете 142).
- Кнопка "Bearbeiten" (`editChild()`) — осталась единственной "обычной"
  кнопкой действия, увеличены паддинги/отступ (`.cp-edit-action-btn`),
  чтобы было проще попасть по ней пальцем.
- Баннер присутствия сегодня (`presenceInfo`,
  `isChildPresentToday()`/`getChildBusForToday()`) — логика не менялась.
- Добавлена кнопка "Checkpoints anzeigen" сразу под баннером
  присутствия, видна только при `userStore.isAdmin` (импортирован
  `useUserStore`, паттерн как в `MainView.vue`) → `router.push({ name:
  'CheckpointChildCard', params: { id: child.id } })`.
- Группа отображается текстом (`child.groupId`), без `GroupLink` —
  сознательно, `GroupLink` ведёт на `requiresAdmin: true` маршрут, а
  `/child/:id` доступен и не-admin Betreuer (см. "Отклонения от плана" —
  отклонений нет, это прямое требование из плана).

## `ChildCardView.vue` (`/admin/checkpoints/child/:id`) — только Checkpoint-история

- Убран инфо-грид ребёнка целиком (Alter/Gruppe/Schwimmabzeichen/
  Armband/Notizen) и кнопка "Bearbeiten" из шапки — эта ответственность
  теперь только у `/child/:id`.
- Источник истории сканов заменён: `useChildren().fetchChildDetailsAndScans()`
  (без фильтра по дате, `limit(50)`) → `useScan().getChildScansForDate(childId)`
  (по умолчанию — только сегодняшняя дата, `scans.date = <today>`).
  Маппинг `scanTypeMap` перенесён из удалённой функции в сам файл.
- Импорты `GroupLink`/`Utils` убраны — компонент/утилита в файле больше
  не используются. Заголовок карточки истории уточнён: "Scan-Historie
  (heute)".
- Неиспользуемые CSS-классы (`.cp-edit-btn`, `.cp-info-grid`,
  `.cp-info-item-wide`, `.cp-info-label`, `.cp-info-value`) удалены из
  `<style scoped>` вслед за удалённой разметкой.
- `goBack()` (уже `router.back()`) и `getChildById()` (для заголовка) —
  не менялись.

## `ChildLink.vue`

Целевой маршрут изменён с `/admin/checkpoints/child/${child.id}` на
`/child/${child.id}` — единственная точка, откуда ссылались на старый
маршрут (`EntityListCard.vue`/`EntityListView.vue`, `CheckpointLazyView.vue`
используют компонент без изменений в себе).

## `useChildren.js`

`fetchChildDetailsAndScans()` удалена как мёртвый код — после перевода
`ChildCardView.vue` на `useScan().getChildScansForDate()` у функции не
осталось потребителей (подтверждено грепом по `src/` до и после правки).
Экспорт функции убран из возвращаемого объекта композабла.

# Отклонения от плана

Отсутствуют — реализация соответствует `IMPLEMENTATION_PLAN.md`, включая
рекомендацию по мёртвому коду (`fetchChildDetailsAndScans` удалена, а не
оставлена с пометкой).

# Миграции

Отсутствуют — тикет не меняет схему БД/RLS/RPC, используется только уже
существующая колонка `scans.date` через уже существующий композабл
`useScan().getChildScansForDate()`.

# Проверки

- `npm run build` — проходит без ошибок (только предсуществующие
  предупреждения: chunk size >500kB для `index-*.js`, устаревшие данные
  `caniuse-lite`/`baseline-browser-mapping` — не связаны с этой правкой).
- Грепом подтверждено: все существующие точки входа на `ChildDetail`
  (`ArmbandView.vue:154,212`, `ChildEditView.vue:255`,
  `GroupEditView.vue:172`) не изменялись и продолжают использовать
  `router.push({ name: 'ChildDetail', ... })`.
- Грепом подтверждено: `fetchChildDetailsAndScans` и `GroupLink` (как
  реальный импорт, не как текст в комментарии) в `ChildCardView.vue`/
  `ChildDetailView.vue` отсутствуют после правки.
- Ручная проверка в браузере/на реальном устройстве (переходы из всех
  точек входа, "Zurück" с разных экранов, видимость кнопки "Checkpoints
  anzeigen" для admin/non-admin, фильтр истории по сегодняшней дате,
  работа "Entfernen" на объединённом экране) — вне возможностей текущей
  сессии (нет браузера/устройства), как и во всех предыдущих тикетах
  серии — отложена до проверки пользователем.

# Исправления после ревью

По `REVIEW_REPORT.md` (`CHANGES_REQUIRED`), закрыты оба пункта из
«Список обязательных исправлений»:

1. **Major 1 — устаревшая vault-документация.** Обновлены три файла,
   ссылавшиеся на удалённую `useChildren.fetchChildDetailsAndScans()`
   и/или описывавшие дореформенное (тикет 133) назначение
   `ChildCardView.vue`/`ChildDetailView.vue`:
   - `vault/06-Маршруты-и-URL/Карта-маршрутов.md` — шапка дополнена
     пометкой про тикет 151; строки таблицы для `/child/:id` и
     `/admin/checkpoints/child/:id` описывают новое, не пересекающееся
     разделение ответственности (объединённая карточка + кнопка
     «Checkpoints anzeigen» для admin vs. только today-scoped история
     сканов).
   - `vault/05-API-Composables/useChildren.md` — запись про
     `fetchChildDetailsAndScans()` заменена записью про `getChildById()`
     (реальный метод, уже задействованный обоими экранами); раздел
     «Текущие потребители» обновлён под тикет 151 (добавлен
     `ChildDetailView.vue`, явно отмечено удаление
     `fetchChildDetailsAndScans()` и замена на
     `useScan().getChildScansForDate()`).
   - `vault/03-База-данных/scans.md` — обе ссылки на
     `useChildren.fetchChildDetailsAndScans()` (в описании колонки
     `type` и в разделе «Кто читает/пишет») заменены на актуальные:
     `ChildCardView.vue` (маппинг `type` теперь там) и
     `useScan().getChildScansForDate()` (today-scoped источник истории).

   Минимальный набор, обозначенный ревью как «как минимум»
   (`Карта-маршрутов.md` + `useChildren.md`), расширен третьим файлом
   (`scans.md`) — ревью явно рекомендовало его тоже проверить
   («Рекомендации», п.1), и там нашлась та же устаревшая ссылка на
   удалённую функцию.

2. **Minor 1 (перенесён в «Список обязательных исправлений») —
   незарегистрированная иконка `clock-rotate-left`.** В `src/main.js`
   добавлен импорт `faClockRotateLeft` (из
   `@fortawesome/free-solid-svg-icons`, по алфавиту — между
   `faClipboardCheck` и `faCog`, как и остальные иконки в файле) и
   вызов `library.add(faClockRotateLeft)`. Иконка используется в трёх
   местах (`ChildDetailView.vue:68`, `ChildCardView.vue:33`,
   `GroupEntityView.vue:55`) — правка в одной точке (`main.js`) чинит
   отображение сразу во всех трёх, включая предсуществующий баг в
   `GroupEntityView.vue`, не упомянутый явно в ревью, но той же природы.

Minor 2 (`.cp-header` без `margin-bottom: 8px`) и Minor 3
(неиспользуемые поля в ответе `getChildScansForDate()`) — по
`REVIEW_REPORT.md` числятся в «Список необязательных улучшений», не в
обязательных исправлениях; согласно правилу минимизации изменений при
устранении замечаний ревью — не тронуты в рамках этого прохода.

# Измененные файлы

- `src/main.js` — зарегистрирована иконка `faClockRotateLeft`.
- `vault/06-Маршруты-и-URL/Карта-маршрутов.md` — актуализировано
  описание `/child/:id` и `/admin/checkpoints/child/:id`.
- `vault/05-API-Composables/useChildren.md` — убрана ссылка на удалённый
  метод, обновлён список актуальных методов и потребителей.
- `vault/03-База-данных/scans.md` — убраны ссылки на удалённый метод.

# Проверки

- `npm run build` — проходит без ошибок (те же предсуществующие
  предупреждения о размере чанков и устаревших данных
  `caniuse-lite`/`baseline-browser-mapping`, что и до этой правки).
- Грепом подтверждено: `faClockRotateLeft` присутствует и в блоке
  `import { ... } from '@fortawesome/free-solid-svg-icons'`, и в
  `library.add(...)` в `src/main.js`.
- Грепом подтверждено: во всех обновлённых vault-файлах не осталось
  вхождений `fetchChildDetailsAndScans`.
- Визуальная проверка иконки в браузере не выполнялась (нет
  браузера/устройства в текущей сессии) — как и вся остальная ручная
  проверка UI по тикету, отложена до проверки пользователем.
