# Измененные файлы

* `src/views/ScannerSettingsView.vue`
  * `<template>`: под списком камер добавлен квадратный контейнер
    предпросмотра `.preview-square` с постоянным дочерним `<div
    id="qr-settings-preview">` (точка монтирования `Html5Qrcode`, всегда в
    DOM) и тремя взаимоисключающими overlay-состояниями поверх него —
    `idle` (автоматический режим), `starting` (спиннер), `error` (алерт с
    текстом ошибки). Состояние `active` overlay не рендерит — сквозь
    прозрачный `#qr-settings-preview` виден живой `<video>`.
  * `<script setup>`: добавлены константа `PREVIEW_CONFIG` (та же форма,
    что `SCANNER_CONFIG` в `Scanner.vue`), локальные переменные
    `html5QrCode`, `streamActive`, `isComponentMounted`, `switchQueue`,
    `ref`ы `previewState`/`previewError`, функции `startPreview()`,
    `stopPreview()`, `switchPreview()`, `watch()` на
    `[settings.preferredCameraId.value, settings.cameraList.value]` с
    `immediate: true`, и `onBeforeUnmount()`.
  * `<style scoped>`: добавлены `.preview-square`, `#qr-settings-preview`,
    `#qr-settings-preview :deep(video/canvas)`, `.preview-overlay` —
    приём аналогичен `Scanner.vue` (`.proto-scan-area`/`#qr-reader-proto`).

# Новые файлы

Отсутствуют.

# Реализованные изменения

1. При выборе конкретной камеры из списка (`settings.setPreferredCameraId`)
   `watch()` реагирует на изменение `preferredCameraId` и вызывает
   `switchPreview(cameraId)`, который останавливает предыдущий поток (если
   был) и запускает `Html5Qrcode.start(cameraId, PREVIEW_CONFIG, noop,
   noop)` — живой видеопоток с рамкой распознавания QR (250×250,
   `qrbox`) отображается в квадратной области. Оба callback'а декода —
   пустые функции: успешное распознавание в превью намеренно ни к чему не
   приводит (152.txt, п. 4).
2. Переключение между камерами сериализовано через цепочку промисов
   `switchQueue = switchQueue.then(...)` — каждый вызов `switchPreview()`
   ждёт завершения предыдущего (включая `stop()`/`start()`) перед тем как
   начать свой; наложения двух потоков или гонок при быстром
   переключении не возникает.
3. `streamActive` (обычная переменная, не `ref`) отслеживает реальное
   состояние потока независимо от `previewState` — `stopPreview()`
   вызывает `html5QrCode.stop()` только если поток был реально запущен,
   и оборачивает вызов в `try/catch`, чтобы исключение из `stop()` (поток
   уже не активен) не ронуло страницу — паттерн аналогичен
   `stopScanning()` в `Scanner.vue`.
4. `isComponentMounted` (по аналогии со `Scanner.vue`, тикеты 141/141_2)
   выставляется в `false` в `onBeforeUnmount()`, который дополнительно
   гарантированно вызывает `await stopPreview()` — при переходе на другой
   экран поток останавливается; проверки `isComponentMounted` после
   каждого `await` внутри `startPreview()`/`switchPreview()` не дают
   асинхронному `start()` "воскресить" состояние `active` уже после
   размонтирования.
5. Режим "Automatische Kamerawahl" (`preferredCameraId === null`) —
   превью не запускается, показывается нейтральный текст
   ("Kamera wird beim Scannen automatisch gewählt"); обоснование см.
   ниже, "Отклонения от плана" (архитектурное решение, зафиксированное в
   плане).
6. Восстановление ранее сохранённой камеры при открытии страницы:
   `watch(..., { immediate: true })` учитывает и `preferredCameraId`, и
   `settings.cameraList.value` — при первом срабатывании список камер
   ещё пуст (`loadCameraList()` в `onMounted()` асинхронна), поэтому
   превью не стартует; когда список загружается, `watch` срабатывает
   повторно и запускает превью для сохранённого `id`, если устройство с
   таким `id` всё ещё присутствует в списке (проверка
   `list.some(device => device.id === cameraId)`, аналог
   `preferredCameraStillExists` в `Scanner.vue`). Если устройства больше
   нет — превью остаётся в `idle`, `preferredCameraId` не сбрасывается
   (как и предусмотрено планом).
7. Ошибка запуска потока (`html5QrCode.start()` бросает исключение,
   например `NotFoundError`/устройство занято) — перехватывается в
   `startPreview()`, `previewState` переходит в `'error'`, текст ошибки
   показывается тем же визуальным стилем `.alert.alert-danger`, что и
   существующий `cameraLoadError` для списка камер; остальная часть
   страницы (ползунки длительностей) не блокируется.

# Отклонения от плана

Отклонений от архитектурного плана нет. Реализация буквально следует
`IMPLEMENTATION_PLAN.md`, включая явно зафиксированное в нём
архитектурное решение (не жёсткое требование `152.txt`): в режиме
"Automatische Kamerawahl" превью намеренно не запускается (см. план,
раздел "UI изменения" — показ произвольно выбранной из списка камеры
вводил бы в заблуждение, так как реальный выбор при сканировании
делается эвристикой `facingMode` в `Scanner.vue`, а не по `id` из
списка).

# Проверки

* `npm run build` — сборка проходит без ошибок (существующее
  предупреждение Rollup про размер чанка `index-*.js` не относится к
  изменённому файлу и присутствовало до этого тикета).
* Правка ограничена файлом `src/views/ScannerSettingsView.vue`, как и
  требовалось планом — `Scanner.vue`, `useScannerSettings.js`, БД/API не
  затронуты.
* Ручная проверка на устройстве/в браузере (открытие `/scanner-settings`,
  выбор камеры, быстрое переключение, переход на другой экран с проверкой
  индикатора камеры ОС, повторное открытие с ранее сохранённой камерой) —
  **не выполнена в рамках этой сессии**, требует интерактивного
  браузера/устройства с камерой. Зафиксировано как открытый пункт наравне
  с остальными device-тестами по другим недавним тикетам (см.
  `tickets/dashboard.md`).
