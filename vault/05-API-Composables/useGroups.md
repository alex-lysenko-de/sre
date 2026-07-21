# `useGroups.js`

> Источник: `src/composables/useGroups.js`.

Единственный composable в проекте, который экспортирует **именованные
функции напрямую** (`export async function ...`), а не через обёртку
`useGroups()` — отличается от общего паттерна, описанного в
[[Обзор-composables]].

## Функции

- `fetchGroupsData(date)` — строит список **всех** групп `1..totalGroups`
  (из [[config]] через `useConfigStore`, дефолт 15, если конфиг не
  загружен), объединяя счётчики из [[groups_today]] и имена Betreuer из
  [[user_group_day]] (только те, у кого `isPresentToday = 1` за указанную
  дату). Группы без данных всё равно попадают в результат с нулями и
  `hasData: false`.
- `fetchGroupDetails(groupId)` — детали одной группы: счётчики из
  `groups_today`, список детей из [[children_today]] JOIN [[children]]
  (только `presence_today > 0`), список Betreuer из `user_group_day` JOIN
  [[users]] за сегодня.
- `getGroupSummary(date)` — сводная статистика поверх `fetchGroupsData()`:
  `totalMorning`, `totalCurrent`, `totalMissing` (разница «утро минус
  сейчас» по группам, где она положительна).
- `subscribeToGroupsChanges(callback)` — Realtime-подписка на
  `postgres_changes` для [[groups_today]].

## Почему полный диапазон `1..totalGroups`, а не только группы с данными

Отражает бизнес-правило: количество групп фиксировано конфигурацией
(`config.total_groups`) заранее, вне зависимости от того, зарегистрирован
ли кто-то в группе сегодня (см. [[Группы-и-рабочий-день]]) — UI должен
показывать все группы, включая пустые, а не только те, у кого уже есть
активность.

## Связанные заметки

- [[groups_today]]
- [[user_group_day]]
- [[children_today]]
- [[children]]
- [[config]]
- [[Группы-и-рабочий-день]]
