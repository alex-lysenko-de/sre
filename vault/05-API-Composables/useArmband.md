# `useArmband.js`

> Источник: `src/composables/useArmband.js`, `doc/ArmbandTask.md`.

Работа с идентификацией/привязкой браслетов — единственная таблица
[[children]]. Реализует основной сценарий из [[Идентификация-ребёнка]].

## Методы

- `getBraceletStatus(bandId)` — `children` по `band_id`, `maybeSingle()`;
  `null`, если браслет не привязан.
- `getChildrenByGroup(groupId)` — список детей группы (для формы привязки
  браслета из своей группы).
- `getChildDetails(childId)` — полная запись ребёнка (`select('*')`).
- `checkBraceletAlreadyBound(bandId)` — используется перед привязкой, чтобы
  не перезаписать чужую привязку молча.
- `assignBraceletToChild(childId, bandId)` — сначала проверяет
  `checkBraceletAlreadyBound()`, при конфликте бросает описательную ошибку
  с именем ребёнка, которому браслет уже принадлежит; иначе
  `UPDATE children SET band_id = ...`.
- `recordChildPresence(userId, childId, bandId, busId)` — `INSERT INTO
  scans` (см. [[scans]]), что через триггер `on_scan_insert` (см.
  [[Триггеры]]) обновляет [[children_today]].

## Связь с `useChildren.js`

Часть тех же операций (`bindBraceletToExistingChild`, `unbindBracelet`)
продублирована/переопределена в [[useChildren]] для сценария
редактирования карточки ребёнка администратором — небольшое пересечение
ответственности между двумя composables, унаследованное из истории
развития фичи (`ArmbandTask.md` описывал `useArmband.js` как единый модуль
до появления отдельного экрана управления детьми).

## Связанные заметки

- [[children]]
- [[scans]]
- [[Триггеры]]
- [[Идентификация-ребёнка]]
- [[useChildren]]
- [[Карта-маршрутов]]
