# Ticket 135: План реализации

## Слои

Чисто UI-тикет поверх готовых `useCheckpoints.js`/
`useLazyCheckpointProgress.js` (тикет 133) — новых composables/таблиц не
добавляется. Один новый экран, точный аналог
`CheckpointLazyPrototypeView.vue` (130_2), без нового переиспользуемого
компонента — `CheckpointStatusBadge`/`CheckpointOriginBadge`/`CountLink`/
`ChildLink` уже скопированы в `src/components/checkpoints/` тикетами
133/134.

## Отличие от прототипа: без DebugTag, импорты без -Mock/-prototype

По образцу тикета 134: `DebugTag`-разметка и `-Mock`-импорты убраны,
`useLazyCheckpointProgressMock`/`useCheckpointsMock` заменены на реальные
`useLazyCheckpointProgress`/`useCheckpoints`, импорты компонентов — из
`@/components/checkpoints/` (без `-prototype`-суффикса).

## Realtime

Тот же паттерн, что `CheckpointBusView.vue`/`CheckpointGroupView.vue`
(134): собственный `supabase.channel('checkpoint-lazy-<id>-changes')`,
слушает **обе** таблицы — `checkpoints` (`id=eq.<id>`) и `scan_packets`
(`checkpoint_id=eq.<id>`), debounce 400ms. Композабл-подписка
(`subscribeToCheckpointsChanges`, тикет 133) слушает только `checkpoints`
и не реагирует на новые пакеты в уже открытой точке — недостаточно для
"без ручного действия" (135.txt, п.4).

## Finish/Reopen/Remove

Тот же паттерн, что Bus/Group (134): `finishCheckpoint`/`reopenCheckpoint`/
`removeCheckpoint` из `useCheckpoints.js`, предупреждение при
`checkpointHasOpenIssues()` перед Finish. Для LAZY эта функция уже
реализована в 133 (`useCheckpoints.js:412-417`, ветка
`CHECKPOINT_TYPE.LAZY`) — `notYet.length > 0` как предупреждение, не
запрет, ровно как того требует 135.txt ("Критерий готовности Lazy к
Finish — решено, не открытый вопрос"). Никакого авто-Finish не
добавляется (135.txt, "Что не входит").

## Список "Noch nicht gemeldet" по группам

`notYetByGroup` — тот же `computed()`, что в прототипе: группирует
`progress.notYet` по `groupId`, сортирует по номеру группы. Реализовано
как в моке (128.txt/133-фидбек: плоский список ~150 детей не
навигируем).

## Маршрут

`/admin/checkpoints/lazy/:id` — рядом с уже существующими 134-маршрутами
в общем namespace `/admin/checkpoints/...` (135.txt, "Затрагиваемые
части проекта"). `CheckpointListView.vue` (134) уже вызывал
`routeForType()` → `'lazy'`, но `openDetail()` перехватывал LAZY явным
`alert()`, так как маршрута не существовало (найдено ревью 134,
Minor-замечание) — теперь маршрут есть, защита снята, `openDetail()`
переходит на `/admin/checkpoints/lazy/:id` как и для Bus/Group.

## Definition of Done

- `CheckpointLazyView.vue` работает на `useCheckpoints.js`/
  `useLazyCheckpointProgress.js`, `npm run build` проходит.
- Ручная проверка на устройстве (авто-создание Lazy-точки по первому
  CHECKIN-пакету, постепенное появление отметившихся в реальном времени,
  явный Finish с предупреждением) — **не выполнена** в этой сессии (нет
  доступа к браузеру/устройству).
