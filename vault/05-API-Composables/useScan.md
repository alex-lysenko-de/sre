# `useScan.js`

> Источник: `src/composables/useScan.js`.

Полный набор запросов к [[scans]] — истории сканирований, в дополнение к
записи через [[useArmband]].`recordChildPresence()`.

## Методы

- `getTodayDate()` — `YYYY-MM-DD` (используется как значение по умолчанию
  почти во всех методах ниже).
- `isChildPresentToday(childId, date?)` — есть ли хоть один скан ребёнка за
  дату.
- `getChildBusForToday(childId, date?)` — последний по времени скан с
  заполненным `bus_id` (реализует правило «последнее сканирование
  определяет автобус», см. [[Учёт-автобусов]]).
- `getChildScansForDate(childId, date?)` — все сканы ребёнка за дату.
- `getChildAttendanceDays(childId)` — уникальные даты, когда у ребёнка был
  хотя бы один скан (по всей истории).
- `getPresentChildrenForDate(date?)` — все дети, отсканированные в эту
  дату, сгруппированные по `child_id` с последней известной `bus_id`.
- `getPresentChildrenDetailsForDate(date?)` — то же самое, но с JOIN на
  [[children]] (имя, возраст, группа).
- `createScan(scanData, date?)` — прямая вставка в `scans` (используется
  реже, чем `useArmband.recordChildPresence()`, который делает то же самое
  с более узким интерфейсом параметров).

## Почему группировка «по последнему скану»

`getPresentChildrenForDate`/`getPresentChildrenDetailsForDate` перебирают
сканы в порядке `created_at DESC` и берут первую встреченную `bus_id` для
каждого ребёнка — так реализуется бизнес-правило «если ребёнок пересел в
другой автобус, актуально последнее сканирование» (см.
[[Учёт-автобусов]]) без необходимости отдельного `DISTINCT ON` на стороне
БД.

## Связанные заметки

- [[scans]]
- [[children]]
- [[useArmband]]
- [[Учёт-автобусов]]
- [[Переклички]]
