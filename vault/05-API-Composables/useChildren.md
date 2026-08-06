# `useChildren.js`

> Источник: `src/composables/useChildren.js`.

CRUD-слой для карточек детей (администрирование, в отличие от
«полевого» использования браслетов в [[useArmband]]).

## Методы

- `createChildAndBind(childData, bandId)` — создаёт ребёнка сразу с
  привязанным браслетом.
- `bindBraceletToExistingChild(childId, bandId)` — если браслет уже
  привязан к другому ребёнку, сначала вызывает `unbindBracelet()`
  (отвязка), затем привязывает к новому — в отличие от
  [[useArmband]].`assignBraceletToChild()`, который в этом случае **бросает
  ошибку**, а не переотвязывает молча. Это два разных сценария UX:
  сканирование в поле (безопаснее спросить) vs. администрирование
  (осознанное переназначение).
- `unbindBracelet(bandId)` — `UPDATE children SET band_id = null`.
- `fetchAllChildren()` — полный список для выпадающих списков (`id, name,
  group_id`).
- `fetchChildrenByGroup(groupId)` — список детей группы (`id, name, age,
  band_id`), добавлен в тикете 106 для удалённого `HeadcountView.vue`
  (тикет 137); сейчас используется [[Checkpoint]]-composables
  (`useCheckpoints.js`, `useLazyCheckpointProgress.js`).
- `fetchChildrenList(searchTerm)` — поиск по имени (`ilike`) **или**
  `band_id` (точное совпадение) — использовался в удалённом
  `ChildrenView.vue` (тикет 137); актуальные потребители см. ниже.
- `getChildById(id)` — карточка ребёнка; часть полей нормализована в
  camelCase (`groupId`/`busId` вместо `group_id`/`bus_id`), используется
  `ChildDetailView.vue`/`ChildCardView.vue` (см. [[Карта-маршрутов]]).
- `deleteChild(childId)` / `saveChild(childData)` — стандартный
  insert/update с очисткой `notes` (пустая строка вместо `'""'` —
  устаревшее значение по умолчанию в схеме, см. [[children]]) и
  нормализацией `band_id` в строку числа или `null`.

## Обработка конфликта уникальности `band_id`

`saveChild()` перехватывает код ошибки Postgres `23505` (unique violation)
и превращает его в понятное сообщение о том, что браслет уже занят другим
ребёнком — вместо технического текста ошибки БД.

## Текущие потребители (тикет 151)

`ChildrenView.vue` удалён тикетом 137. Актуальный список (`^import`,
проверено грепом): `GroupEditView.vue`, `ChildEditView.vue`,
`SelectChildView.vue`, `AddEditChildModal.vue`, `ChildCardView.vue`
(тикет 133/151 — только `getChildById()` для заголовка,
Checkpoint-история сканов через [[useScan]]),
`ChildDetailView.vue` (с тикета 151 — тоже `getChildById()`, вместо
прежнего [[useArmband]].`getChildDetails()`), плюс
[[Checkpoint]]-composables
`useCheckpoints.js`/`useLazyCheckpointProgress.js`.

`fetchChildDetailsAndScans(childId)` удалена тикетом 151 (мёртвый код —
единственным потребителем был `ChildCardView.vue`, переведённый на
[[useScan]].`getChildScansForDate()`, today-scoped вместо ungefiltert
limit 50; сопоставление `type` → человекочитаемый текст переехало в сам
`ChildCardView.vue`, см. [[scans]]).

## Связанные заметки

- [[children]]
- [[scans]]
- [[useArmband]]
- [[Checkpoint]]
- [[Идентификация-ребёнка]]
