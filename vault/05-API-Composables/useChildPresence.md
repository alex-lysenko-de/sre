# `useChildPresence.js`

> Источник: `src/composables/useChildPresence.js`, тикет 106
> (`tickets/106/IMPLEMENTATION_PLAN.md`, `tickets/106/IMPLEMENTATION_REPORT.md`).

Composable для ручной переклички (Kopfzählung/Headcount) —
`HeadcountView.vue`. Единственная задача: читать и переключать
`presence_now`/`presence_morning` в [[children_today]], **без** создания
записей в [[scans]] (в отличие от сканирования через [[useArmband]]).

## `getTodayGroupPresence(groupId)`

Возвращает `Map<child_id, {presence_morning, presence_now}>` для всех
записей `children_today` данной группы — используется, чтобы объединить с
полным списком детей группы (`useChildren.fetchChildrenByGroup()`) на
уровне `HeadcountView.vue`: дети без записи в `children_today` отображаются
как «ещё не отмечены».

## `setPresentNow(childId, groupId, isPresent, currentUserId)`

Переключает только `presence_now`. Реализовано как **SELECT, затем
ветвление UPDATE/INSERT** — намеренно не через `upsert()`/`ON CONFLICT`,
чтобы гарантированно не задеть `presence_morning`/`presence_today`, которые
Supabase upsert мог бы неявно перезаписать значениями по умолчанию при
отсутствии строки. Если строка есть — `UPDATE ... SET presence_now,
user_id`; если нет — `INSERT` новой строки с указанным `group_id` и
`presence_now`, без затрагивания `presence_morning` (остаётся `NULL` до
первого реального скана, см. [[children_today]]).

## Почему не через триггер/скан

Ручная отметка присутствия должна быть доступна и там, где сканирование
браслета невозможно (камера недоступна, см. [[Идентификация-ребёнка]]) —
но при этом не должна создавать фиктивные записи в истории сканов
[[scans]], которая по смыслу — журнал именно сканирований. Отсюда прямая
работа с `children_today` в обход `on_scan_insert`.

## RLS

Доступ на запись ограничен политиками `own_group_update_presence_now` /
`own_group_insert_presence_now` — своя группа на сегодня либо admin. См.
[[RLS-политики]].

## Связанные заметки

- [[children_today]]
- [[Триггеры]]
- [[RLS-политики]]
- [[useChildren]]
- [[Переклички]]
