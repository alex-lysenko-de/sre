# Ticket 134: План реализации

## Слои

Чисто UI-тикет поверх готового `useCheckpoints.js` (тикет 133) — новых
composables/таблиц не добавляется. Три экрана, точные аналоги
`CheckpointListPrototypeView.vue`/`CheckpointBusPrototypeView.vue`/
`CheckpointGroupPrototypeView.vue` (130_2), плюс 4 переиспользуемых
компонента (`CheckpointCreateModal`/`CheckpointStatusBadge`/
`CheckpointTypeBadge`/`CheckpointOriginBadge`), скопированных из
`checkpoints-prototype/` в `src/components/checkpoints/` (без суффикса
`-prototype`, по аналогии с тикетом 133).

## Ключевое отличие от прототипа: async breakdown/delta

`useCheckpointsMock.js` (мок) — `getBusChildrenBreakdown`/
`getGroupChildrenBreakdown`/`getBusDelta`/`getGroupDelta` были
синхронными, прототип вызывал их напрямую внутри `computed()`. Реальный
`useCheckpoints.js` (тикет 133) сделал их `async` — синхронный `computed()`
для них больше не работает. Решение: вычисляются один раз в `load()` и
кладутся в `ref` (`breakdownCounts`, `busDeltas` в Bus-View), шаблон читает
уже готовые значения вместо вызова функции при рендере.

## Realtime

`useSupabaseCheckpoints.subscribeToCheckpointsChanges()` (тикет 133) слушает
только таблицу `checkpoints` — этого недостаточно: числа на экранах
(Kinder/Betreuer/Anwesend/Fehlend, per-Bus/per-Gruppe разбивка) вычисляются
из `scan_packets`/`scans`, которые не меняют строку `checkpoints` при
поступлении нового пакета в уже открытую точку. Поэтому каждый из трёх
экранов сам открывает канал (`supabase.channel(...)`, по образцу
`AdminBusView.vue.setupRealtimeSubscription()`) и слушает **обе** таблицы:
- `CheckpointListView.vue`: `checkpoints` (`day=eq.<today>`) +
  `scan_packets` (`date=eq.<today>`).
- `CheckpointBusView.vue`/`CheckpointGroupView.vue`: `checkpoints`
  (`id=eq.<id>`) + `scan_packets` (`checkpoint_id=eq.<id>`).

С debounce (400ms, по образцу `AdminBusView.vue`), чтобы пачка INSERT'ов из
одного пакета не вызвала N перезагрузок.

## Отклонение: "Gesamt"-плитка убрана из CheckpointListView

В прототипе главный экран показывал плитку "Gesamt" (Kinder/Betreuer) —
в шапке файла явно помечена как синтетическая константа ("nicht aus
useBusData/useGroups"). `134.txt` не описывает для неё реальный источник
данных, а её пункт 1 ("Что должно быть реализовано") не упоминает эту
плитку вовсе. Придумывать для неё новую метрику вне периметра тикета —
scope creep, поэтому плитка не перенесена; отмечено как осознанное
отклонение.

## Маршруты

`/admin/checkpoints` (List), `/admin/checkpoints/bus/:id`,
`/admin/checkpoints/group/:id` — рядом с уже существующими
`-prototype`-маршрутами (не удаляются, тикет 137) и с
`/admin/checkpoints/list|child/:id|betreuer/:id|group-entity/:id` (тикет
133). `MainView.vue` не меняется (см. заголовок `134.txt`) — экраны
достижимы только прямым переходом по URL до тикета 137.

## Definition of Done

- Три реальных экрана работают на `useCheckpoints.js`, `npm run build`
  проходит.
- Ручная проверка на устройстве (авто-создание точки по первому пакету,
  Finish/Reopen/Remove на боевой БД, Realtime без ручного действия) —
  **не выполнена** в этой сессии (нет доступа к браузеру/устройству).
