# Что сделано

## `src/views/ChildDetailView.vue`

- Импорт `useScanPacket` добавлен рядом с уже существующим `useScan`
  (последний остаётся — используется для read-функций
  `isChildPresentToday`/`getChildBusForToday`, вне охвата тикета).
- `handlePresenceConfirm()` переделан: вместо
  `scanComposable.createScan({user_id, child_id, band_id, bus_id,
  type: 1})` — `scanPacketComposable.createPacket('CHECKIN', {})` →
  `addManual({ id: child.value.id })` → `await submitPacket()`. Метод
  `MANUAL` (не `SCAN`) сохраняет различение способа регистрации в
  `scans.method`.
- Валидации (пользователь аутентифицирован, `child.id` есть,
  `band_id` привязан) — без изменений.
- Обработка ошибок — `try/catch` вокруг `submitPacket()`, сообщение
  берётся из `scanPacketComposable.errorMessage.value` (с фолбэком на
  `err.message`), показывается тем же `presenceModalRef.setError(...)`,
  что и раньше — паттерн не менялся, только источник ошибки.
- Success-сообщение упрощено до `✅ Präsenz für <Name> registriert` —
  фрагмент «(Bus #N)» убран (см. ниже, почему).
- Параметр `data` обработчика `handlePresenceConfirm` больше не
  используется (был нужен только для `data.busId`) — сигнатура сведена
  к `()`; `ChildPresenceModal.vue` по-прежнему эмитит `{busId,
  includeBusId}` при `@confirm`, лишний аргумент просто игнорируется.

# Отклонения от 136.txt/IMPLEMENTATION_PLAN.md

Нет отклонений от шагов 1-4 "Что должно быть реализовано". Один
осознанный побочный эффект перехода на `submit_scan_packet()`,
зафиксированный в `IMPLEMENTATION_PLAN.md` ("Известное следствие"):
выбор автобуса в `ChildPresenceModal.vue` (`data.busId`) раньше
записывался в `scans.bus_id` напрямую через `createScan`; теперь это
невозможно ни при каком клиентском коде — CHECKIN-пакеты (`type = 3`)
запрещено снабжать `bus_id` констрейнтом `scan_packets.sql:44-46`, а
`useScanPacket.createPacket('CHECKIN', ...)` и так всегда выставляет
`packet.bus_id = null`. Аналогично `band_id` не попадает в
`scans`-инсерт `submit_scan_packet()` (в отличие от старого прямого
`insert`). Это следствие уже принятой архитектуры Packet-модели
(`checkpoints.sql:340-350`), не что-то, что можно починить в рамках
клиентского тикета с охватом "только `ChildDetailView.vue`" — 136.txt
не требует сохранения этих полей и не включает `ChildPresenceModal.vue`
в затрагиваемые файлы. `ChildPresenceModal.vue` оставлен без изменений
(Bus-чекбокс в нём по-прежнему отображается, но выбор больше ни на что
не влияет для этой кнопки) — стоит иметь в виду при планировании
следующих тикетов над этим экраном.

# Применение к боевой БД / ручная проверка

Не выполнено в этой сессии (нет доступа к браузеру/устройству):
- Привязка нового браслета → «Präsenz registrieren» → ребёнок появляется
  как «отметился» в `CheckpointLazyView.vue` (тикет 135) без
  дополнительных действий администратора.
- Поведение при сетевой/серверной ошибке `submitPacket()` (сообщение в
  модалке, повторный клик повторяет тот же `client_packet_id`).

`npm run build` — пройден без ошибок и без новых предупреждений о
размере бандла; `ChildDetailView.vue` не выделяется в отдельный чанк
(входит в основной `index-*.js`, как и раньше).

# Зафиксировано в дашборде

`tickets/dashboard.md`, `tickets/136/state.txt` → `DEVELOPMENT_DONE`
(разработка готова; ручная проверка на устройстве — следующий шаг,
отдельно подтверждаемый пользователем).
