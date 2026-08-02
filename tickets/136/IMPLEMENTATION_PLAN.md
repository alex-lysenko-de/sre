# Ticket 136: План реализации

## Слои

Чисто клиентский тикет поверх уже готового `useScanPacket.js` (тикет
120/126) и расширенного `submit_scan_packet()` (тикет 132) — новых
composables/таблиц/Edge-Function-правок не требуется.
`useScan.js`/`ChildPresenceModal.vue` не меняются (135.txt-стиль явного
ограничения охвата — 136.txt, "Затрагиваемые части проекта").

## Замена обработчика кнопки

`ChildDetailView.vue`, `handlePresenceConfirm()`: вместо прямого
`scanComposable.createScan({..., bus_id: data.busId, ...})` —

```js
scanPacketComposable.createPacket('CHECKIN', {})
scanPacketComposable.addManual({ id: child.value.id })
await scanPacketComposable.submitPacket()
```

Один клик — один пакет с одним ребёнком, `method: 'MANUAL'`
(`addManual`, в отличие от `addScanned` в `ScannerCheckinView.vue`) —
сохраняет различение «отсканирован vs внесён вручную» в `scans.method`,
как и предусмотрено 136.txt ("Что прочитать перед началом").
Валидации (`userStore.userInfo.id`, `child.value.id`,
`child.value.band_id`) — сохранены без изменений, это независимые от
способа записи предусловия UX-потока «браслет привязан → отметить
присутствие».

## Обработка ошибок

По образцу `ScannerCheckinView.vue::handleSend` (тикет 120/126):
`try/catch` вокруг `submitPacket()`, сообщение об ошибке —
`scanPacketComposable.errorMessage.value` (уже выставлено внутри
`submitPacket()` при неуспехе) с фолбэком на `err.message`, показывается
через существующий `presenceModalRef.setError(...)` (не изобретается
новый паттерн, 136.txt п.3).

## Известное следствие (не входит в исправление этого тикета)

`useScanPacket.createPacket('CHECKIN', ...)` всегда выставляет
`packet.bus_id = null` (только `type === 'BUS'` пакеты несут `bus_id`,
см. `useScanPacket.js:43`) — и БД-констрейнт `scan_packets.sql:44-46`
запрещает `bus_id` у `type = 3` (CHECKIN) в принципе. Раньше прямой
`createScan({..., bus_id: data.busId})` записывал выбранный в
`ChildPresenceModal.vue` автобус в `scans.bus_id`; после перехода на
`submit_scan_packet()` это уже невозможно ни при каком клиентском коде —
`scans`-инсерт для CHECKIN-пакета в `checkpoints.sql:340-350` берёт
`bus_id` из **пакета** (не из ребёнка), а пакет для CHECKIN его не
несёт. Аналогично для `band_id` (в этом инсерте такой колонки вовсе нет
для scan_packets-based записи). Это прямое следствие Packet-модели, не
баг данного тикета — 136.txt не требует сохранения этих полей и не
упоминает `ChildPresenceModal.vue` в затрагиваемых файлах. `data.busId`
из модалки больше никуда не передаётся (см. "Что не входит" ниже);
success-сообщение с «(Bus #N)» убрано, так как оно перестало бы отражать
реально сохранённое состояние.

## Что не входит

- Правки `ChildPresenceModal.vue` (в т.ч. отключение/скрытие
  Bus-чекбокса, ставшего неэффективным для этого экрана) — не
  упомянуто в 136.txt, не в списке затрагиваемых файлов.
- Правки `useScan.js`, `useChildPresence.js`, `Scanner.vue`,
  `ScannerCheckinView.vue` — явно исключены 136.txt.
- Правки самой `submit_scan_packet()` — уже расширена тикетом 132.

## Definition of Done

- Клик «Präsenz registrieren» создаёт CHECKIN-пакет с одним ребёнком
  через `submit_scan_packet()`, `npm run build` проходит.
- Ручная проверка на устройстве (привязка браслета → «Präsenz
  registrieren» → ребёнок виден в `CheckpointLazyView.vue`, тикет 135,
  без дополнительных действий) — **не выполнена** в этой сессии (нет
  доступа к браузеру/устройству).
