# Измененные файлы

- `src/components/scanner/Scanner.vue` — функция `showExternalMessage()`.

# Новые файлы

Нет.

# Реализованные изменения

В `showExternalMessage()` финальный шаг восстановления камеры после показа
внешнего сообщения (экран «Gesendet»/«Fehler beim Senden», единственный
вызывающий — `handleSend()` в `ScannerBusView.vue`/`ScannerGroupView.vue`/
`ScannerCheckinView.vue`) заменён с `html5QrCode.resume()` на гарантированный
холодный перезапуск через уже существующие в файле `stopScanning()` +
`startCamera()`, как предписано `IMPLEMENTATION_PLAN.md`:

```js
if (wasActive) {
  await stopScanning()
  await startCamera()
}
```

Над функцией добавлен комментарий, фиксирующий причину (зависимость
`resume()` от ненадёжного события `<video>` `"playing"` в `html5-qrcode`,
молчаливый сбой без исключения/rejected promise) — чтобы правку в будущем не
«упростили» обратно к `resume()`.

Правка полностью локальна для `Scanner.vue`. Публичный контракт компонента
(`defineProps`, `defineExpose`) не менялся. Три `ScannerXxxView.vue`
(`ScannerBusView.vue`/`ScannerGroupView.vue`/`ScannerCheckinView.vue`) и
`useScanPacket.js` не менялись — проверено, что все три вызова
`scannerRef.value?.showMessage(...)` используют прежнюю сигнатуру без
изменений.

Путь (1) — обычный цикл скана (`onScanSuccess`/`resumeAfterConfirmation()`,
всё ещё использующий `resume()`) — не менялся, как явно ограничено объёмом
тикета в `IMPLEMENTATION_PLAN.md` («Затрагиваемые модули» / риск 3).

# Отклонения от плана

Нет. Изменение внесено строго согласно `IMPLEMENTATION_PLAN.md`
(«Изменения существующих компонентов» → `Scanner.vue` →
`showExternalMessage()`).

# Миграции

Не требуются — правка чисто клиентская (жизненный цикл камеры в
`Scanner.vue`), БД/Edge Function/API не затрагиваются.

# Проверки

- `npm run build` — пройден успешно (сборка завершилась без ошибок,
  bundle сгенерирован, включая PWA precache).
- Статический просмотр всех трёх вызывающих (`ScannerBusView.vue`,
  `ScannerGroupView.vue`, `ScannerCheckinView.vue`) подтверждает: сигнатура
  `showMessage(variant, display, durationMs)` не изменилась, вызовы не
  требуют правок.
- Ручная проверка на устройстве (обязательный п. 4 плана реализации —
  сканирование во всех трёх режимах, «Senden» сразу после последнего скана,
  успех и ошибка сети, повторный скан после экрана «Gesendet»/«Fehler beim
  Senden») **не выполнена** в рамках этой сессии — как и во всех
  предыдущих тикетах серии (132-140), у сессии ИИ-ассистента нет доступа к
  браузеру/устройству с камерой. Это ожидаемое ограничение, зафиксированное
  в разделе «Риски» плана (риск 1), а не отклонение от него.
  Гипотеза причины (зависимость `resume()` от события `"playing"`)
  установлена чтением исходников `html5-qrcode`
  (`node_modules/html5-qrcode/esm/html5-qrcode.js`,
  `camera/core-impl.js`), не воспроизведена живым тестом — требуется
  подтверждение пользователем по чек-листу из
  `IMPLEMENTATION_PLAN.md` (раздел «План реализации», п. 4) перед переводом
  тикета в `DONE`. Если проверка на устройстве опровергнет гипотезу — по
  плану следует вернуться к архитектурному этапу (например, к запасному
  варианту из `141.txt` — автозакрытие экрана после «Senden»).
