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
  band_id`), добавлен в тикете 106 для `HeadcountView.vue`.
- `fetchChildrenList(searchTerm)` — поиск по имени (`ilike`) **или**
  `band_id` (точное совпадение) — используется в `ChildrenView.vue`.
- `fetchChildDetailsAndScans(childId)` — карточка ребёнка + последние 50
  записей [[scans]] с человекочитаемым `type_name` (`Präsenz` / `Bus
  (Einstieg)` / `Bus (Ausstieg)` — сопоставление только для отображения,
  реально всегда пишется `type=1`, см. [[scans]]).
- `deleteChild(childId)` / `saveChild(childData)` — стандартный
  insert/update с очисткой `notes` (пустая строка вместо `'""'` —
  устаревшее значение по умолчанию в схеме, см. [[children]]) и
  нормализацией `band_id` в строку числа или `null`.

## Обработка конфликта уникальности `band_id`

`saveChild()` перехватывает код ошибки Postgres `23505` (unique violation)
и превращает его в понятное сообщение о том, что браслет уже занят другим
ребёнком — вместо технического текста ошибки БД.

## Связанные заметки

- [[children]]
- [[scans]]
- [[useArmband]]
- [[useChildPresence]]
- [[Идентификация-ребёнка]]
