# Измененные файлы

- `src/App.vue` — кнопка-логотип заменена на иконку `home` + текст "Home";
  блок кнопки "Ich fahre heute mit!", `<DailyCheckInModal>` и связанное
  состояние (`showCheckInModal`, `onCheckInCompleted`, `onCheckInError`)
  удалены; добавлен пункт меню "📷 Scanner" → `/scanner/settings`.
- `src/views/MainView.vue` — добавлена кнопка "Ich fahre heute mit!" в общую
  сетку меню (видна при `isAuthenticated && userStore.isCheckInRequired`),
  импортирован и смонтирован `DailyCheckInModalView.vue` с перенесёнными без
  изменений обработчиками `onCheckInCompleted`/`onCheckInError`; к `v-if`
  кнопок "Bus zählen"/"Gruppen-Appell"/"Freie Meldung" добавлено условие
  `&& !userStore.isCheckInRequired`.
- `src/components/scanner/Scanner.vue` — убран встроенный выбор камеры
  (`.proto-scanner-controls`, `showCameraSelector`, `chooseCamera`,
  `CAMERA_STORAGE_KEY`); камера/длительности читаются из
  `useScannerSettings`; добавлены проп `autoStart` (default `true`), новое
  состояние "камера выключена" с кнопкой "Scan" на всю область,
  `start()` в `defineExpose`, проп `onBindRequested` с персистентной веткой
  confirmation-экрана для статуса `not-found` (кнопки Cancel/"Привязать
  бейдж"); добавлены emits `camera-started`/`camera-stopped`.
- `src/views/ScannerBusView.vue`, `src/views/ScannerGroupView.vue`,
  `src/views/ScannerCheckinView.vue` — кнопка "Reset" заменена на "Close"
  (`router.push('/main')`); `handleReset` сохранён как внутренний helper,
  вызываемый из `handleSend()`; добавлен обработчик `onBindRequested`,
  передаваемый в `Scanner` как `:on-bind-requested`.
- `src/views/HeadcountView.vue` — отдельная кнопка "Scan" и
  `<transition>`-обёртка с `v-if="isOpen"` убраны; `<Scanner>` теперь
  рендерится всегда, с `:auto-start="false"`, `ref="scannerRef"` и
  `@camera-started`/`@camera-stopped`, подключёнными к
  `useGroupScanSession`; мёртвый CSS (`.kz-scan-btn`,
  `.kz-scanner-panel-enter/leave-*`) удалён.
- `src/composables/useGroupScanSession.js` — принимает третий параметр
  `scannerRef`; `openPanel()` заменён на `onCameraStarted()`
  (создаёт новый пакет по событию `camera-started`), `closePanel()`
  вызывает `scannerRef.value?.stop()` вместо `isOpen.value = false`
  (плюс `onCameraStopped()` для синхронизации `isOpen`); тайминг
  `scheduleAutoClose`/`AUTO_CLOSE_IDLE_MS` не изменён.
- `src/router/index.js` — добавлен маршрут `/scanner/settings` →
  `ScannerSettingsView.vue` (lazy, `requiresAuth: true, requiresAdmin: false`).

# Новые файлы

- `src/composables/useScannerSettings.js` — модуль-синглтон (реактивный
  shared state по образцу `src/modules/storage.js`): `cameraList`,
  `preferredCameraId`, `successDurationMs`, `errorDurationMs`,
  `loadCameraList()`, сеттеры с синхронной записью в `localStorage` под
  ключом `scanner_settings`; read-through-миграция старого
  `scanner_preferred_camera_id` при первом чтении.
- `src/views/ScannerSettingsView.vue` — экран настроек: список камер с
  опцией "Automatische Kamerawahl", слайдеры для длительностей
  успеха/ошибки (500–5000 мс); не встраивает `Scanner.vue`, вызывает
  `loadCameraList()` при монтировании.

# Реализованные изменения

Все семь пунктов `tickets/126/126.txt` реализованы согласно
`IMPLEMENTATION_PLAN.md`:

1. Кнопка-логотип в навбаре — иконка `home` + текст "Home".
2. "Ich fahre heute mit!" перенесена из навбара на Willkommen, в общую
   сетку кнопок; навбар больше не содержит эту кнопку и не дёргается.
3. Кнопки пересчёта (Bus zählen/Gruppen-Appell/Freie Meldung) скрыты на
   Willkommen, пока `isCheckInRequired === true`.
4. Выбор камеры и длительностей вынесен из `Scanner.vue` в
   `useScannerSettings.js` + новый экран `/scanner/settings`, доступный
   через пункт меню "📷 Scanner"; применяется во всех потребителях
   `Scanner.vue`.
5. Kopfzählung: область сканера больше не мон­тируется/размонтируется —
   `<Scanner :auto-start="false">` рендерится постоянно, кнопка "Scan"
   встроена в саму область (новое состояние "камера выключена"),
   автовыключение по простою (5с) останавливает только камеру через
   `scannerRef.value.stop()`, раскладка экрана не меняется.
6. Кнопка "Reset" заменена на "Close" на всех трёх экранах режимов
   сканирования; закрытие не отправляет накопленный пакет.
7. Несвязанный бейдж (`not-found`) — персистентный экран с Cancel/
   "Привязать бейдж"; "Привязать бейдж" очищает текущую сессию сканирования
   (`handleReset()`) и переходит на `/armband/:id`; "Cancel" возобновляет
   сканирование без перехода.

# Отклонения от плана

- **Механизм синхронизации состояния камеры с `useGroupScanSession`** —
  план оставлял это на усмотрение реализации ("например через
  `@camera-started`/`@camera-stopped` emit"). Выбран именно этот вариант:
  `Scanner.vue` эмитит `camera-started`/`camera-stopped` при фактическом
  старте/остановке камеры; `useGroupScanSession.onCameraStarted()`
  заменяет прежний `openPanel()` (создаёт новый пакет), `onCameraStopped()`
  синхронизирует `isOpen` (эта переменная теперь не влияет на шаблон,
  оставлена для внутренней логики/консистентности, как и предполагал план).
- **Иконка экрана `/scanner/settings`** — использована уже
  зарегистрированная в проекте иконка `cog` вместо добавления новой
  (`camera`) в `main.js`, чтобы не расширять список зарегистрированных
  FontAwesome-иконок без необходимости. Пункт меню в `App.vue` использует
  эмодзи 📷, как в примере из плана.
- Имя `handleReset` в `ScannerBusView`/`ScannerGroupView`/
  `ScannerCheckinView` оставлено без переименования (план допускал оба
  варианта) — минимизация диффа.
- Открытый вопрос про `onBindRequested` в `HeadcountView.vue` решён так,
  как и зафиксировал план: встроенная панель Kopfzählung **не** передаёт
  этот проп — поведение `not-found` там осталось прежним (автозакрывающийся
  стандартный экран), это осознанное решение, а не недосмотр.

# Миграции

Изменений БД/API нет. Клиентская миграция `localStorage`:
`scanner_preferred_camera_id` (старый ключ) → `scanner_settings` (новый,
единый JSON) выполняется один раз при первом чтении в
`useScannerSettings.js`, если новый ключ ещё не существует.

# Проверки

- `npm run build` — сборка проходит без ошибок (проверено дважды после
  правок).
- Грепом по `src/` подтверждено отсутствие мёртвых ссылок на удалённые
  внутренности `Scanner.vue` (`showCameraSelector`, `chooseCamera`,
  `currentCameraId`, `CAMERA_STORAGE_KEY`, `proto-camera-list`) и на
  удалённые из `App.vue` `showCheckInModal`/`DailyCheckInModal`/`openPanel`.
- Dev-сервер (`npm run dev`) запущен локально, маршруты `/main`,
  `/scanner/settings`, `/headcount` отдают `200`.
- **Ручная проверка в браузере/на устройстве не выполнена** — в этой
  сессии не было доступного инструмента браузерной автоматизации (Chrome
  extension отклонён пользователем для сессии), а часть изменений
  (реальная камера, звук/вибрация, визуальная раскладка навбара/Willkommen
  на обеих ролях, цикл камеры в Kopfzählung) требует именно этого — как и
  в тикетах 120/122/123 этого проекта, эта проверка отложена до ручного
  тестирования пользователем. Рекомендуемый чек-лист — шаг 8 из
  `tickets/126/IMPLEMENTATION_PLAN.md` ("План реализации").

# Исправления по REVIEW_REPORT.md

- **Critical 1 (обязательное)** — `src/components/scanner/Scanner.vue`:
  `isTransitioning` инициализировался значением `props.autoStart`, из-за
  чего собственный guard `startCamera()` (`if (scannerActive.value ||
  isTransitioning.value) return`) блокировал самый первый автозапуск
  камеры на `autoStart=true` (полноэкранные `ScannerBusView`/
  `ScannerGroupView`/`ScannerCheckinView`) — камера не стартовала ни
  автоматически, ни вручную. Исправлено: `isTransitioning` теперь всегда
  стартует с `false`; `onMounted` при `autoStart=false` больше не
  дублирует эту инициализацию (лишняя ветка убрана). `npm run build`
  проходит без ошибок после исправления.
- **Minor 1 (необязательное)** — `handleConfirmationBind` обёрнут в
  try/catch вокруг `props.onBindRequested?.(bandId)`, симметрично
  `onChildResolved`.
- **Minor 2 (необязательное)** — над `defineExpose` в `Scanner.vue`
  добавлен комментарий, документирующий, что `start()` сейчас не
  используется ни одним потребителем (в отличие от `stop()`, который
  вызывает `closePanel()` в `useGroupScanSession.js`), и оставлен как
  симметричный публичный API для будущих вызывающих сторон.
- **Minor 3 и «Список необязательных улучшений» пп. 3–4** — не
  затронуты: формулировка кнопок "Cancel"/"Привязать бейдж" требует
  решения заказчика (не инженерное решение), а гигиена коммитов — это
  процесс, а не правка кода; оба пункта оставлены как есть, как и
  рекомендовал ревьюер.
- **Обязательный пункт 2 (ручная проверка на устройстве)** — по-прежнему
  не выполнена (нет доступа к реальному устройству/браузерной
  автоматизации в этой сессии); статус тикета не может быть переведён в
  финальный "проверено на устройстве" до этого шага.

# Откат навбара после ручного тестирования

Ручное тестирование выявило, что верхняя строка навбара (`App.vue`) без
кнопки "Ich fahre heute mit!" не помещается корректно: кнопка вызова
мобильного меню переносится на следующую строку, между кнопкой Home и
кнопкой выбора группы появляется незапланированный большой промежуток
(следствие `justify-content: space-between` на трёх top-level flex-детях
`.container-fluid` вместо прежних четырёх, когда `isCheckInRequired`
было true). Вместо доработки CSS-раскладки пользователь решил полностью
откатить изменения навбара из 126, с единственным сохранённым отличием —
кнопка "Ich fahre heute mit!" больше нигде не отображается:

- `src/App.vue` — лого снова текст "🌳 SRE" (было: иконка `home` +
  "Home"). Пункт меню "📷 Scanner" **сознательно оставлен** — по
  явному решению пользователя, так как он не участвует в верхней строке
  навбара и не связан с багом переноса.
- `src/views/MainView.vue` — кнопка "Ich fahre heute mit!" (которую 126
  перенёс сюда из навбара) убрана целиком вместе с `<DailyCheckInModal>`,
  `showCheckInModal`, `onCheckInCompleted`/`onCheckInError` — не по
  условию `isCheckInRequired`, а безусловно, как и требовалось
  ("кнопка никогда не показывается, без дополнительного действия
  пользователя"). `DailyCheckInModalView.vue` остаётся в коде
  неиспользуемым (не удалён — решение об удалении всей фичи
  ежедневной регистрации выходит за рамки этого запроса).
- Побочный эффект: кнопки "Bus zählen"/"Gruppen-Appell"/"Freie Meldung"
  на Willkommen по-прежнему скрыты условием `!userStore.isCheckInRequired`
  (126, пункт 3, не затронут этим откатом) — но раз путь их разблокировки
  (`isCheckInRequired → false` через модалку) больше нигде не доступен в
  UI, для пользователей с `isCheckInRequired === true` эти кнопки теперь
  скрыты постоянно. Не устранялось в рамках этого запроса — стоит
  отдельно уточнить у заказчика.


