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
