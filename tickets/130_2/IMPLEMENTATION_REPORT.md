# Измененные файлы

| Файл | Изменение |
|---|---|
| `src/router/index.js` | Добавлены 4 новых маршрута под `/admin/checkpoints-prototype` (список + `bus/:id`, `group/:id`, `lazy/:id`), lazy-loaded (`() => import(...)`, как `/scanner/*`/`/headcount`), `meta: { requiresAuth: true, requiresAdmin: true }` — как у `/admin-busses`/`/children`. Существующие маршруты (`/admin-busses`, `/children` и все остальные) не изменены. |
| `src/views/MainView.vue` | Добавлена одна новая кнопка меню "Checkpoints (Prototyp)" (видна при `userStore.isAdmin`, аналогично "Busse"/"Admin Übersicht"), обработчик `goToCheckpointsPrototype()` → `router.push('/admin/checkpoints-prototype')`. Существующие кнопки ("Busse", "Admin Übersicht" и т.д.) не изменены и не переставлены. |

# Новые файлы

| Файл | Назначение |
|---|---|
| `src/composables/useCheckpointsMock.js` | Mock-слой данных (module-level `reactive([])`-singleton, сознательно не Pinia-стор). Экспортирует константы `CHECKPOINT_TYPE`/`CHECKPOINT_STATUS` и функции `fetchCheckpointsForDay`/`createCheckpoint`/`finishCheckpoint`/`cancelCheckpoint`/`fetchCheckpointDetail`/`isOverdue` — имена и форма идентичны спецификации будущего `useCheckpoints.js` из `tickets/130/IMPLEMENTATION_PLAN.md`. Seed-сценарий при загрузке модуля: Bus FINISHED (сегодня утром, baseline проставлен), Bus OPEN, Group OPEN (параллельно с Bus OPEN — нормальное состояние), вторая Group OPEN (аномалия "две открытые одного типа", только засеяна, ни одним действием не создаваема), Lazy FINISHED (создана явно администратором). Детальные данные Bus/Group (список автобусов/групп, пакеты, недостающие дети) генерируются синтетически на каждый checkpoint и хранятся прямо в его объекте. `MOCK_TOTAL_BUSES`/`MOCK_TOTAL_GROUPS` — хардкоженные константы (без обращения к `useConfigStore`). Ни одного импорта Supabase. |
| `src/composables/useLazyCheckpointProgressMock.js` | Mock-аналог будущего `useLazyCheckpointProgress.js`. `fetchLazyCheckpointProgress(checkpointId)` возвращает `{ checkedIn, notYet, lastScanAt }` из собственного синтетического пула детей (не привязанного к группе, как и реальный тип Lazy). Результат кэшируется по `checkpointId`, чтобы повторные вызовы были согласованы. |
| `src/components/checkpoints-prototype/CheckpointTypeBadge.vue` | Presentational: иконка+подпись по `type` (Bus/Group/Lazy). |
| `src/components/checkpoints-prototype/CheckpointStatusBadge.vue` | Presentational: статус-точка+текст (OPEN/FINISHED/CANCELLED), дополнительный чип "Überfällig" (`day < сегодня && status === OPEN`, использует `isOverdue()` из mock-composable) и опциональный чип-аномалия "Anomalie: mehrere offen" (проп `anomaly`, выставляется списковым экраном). |
| `src/components/checkpoints-prototype/CheckpointOriginBadge.vue` | Presentational: различает "Admin" и "Auto (Betreuer X)" по `created_by.isAdmin`/`created_by.name`. |
| `src/components/checkpoints-prototype/CheckpointCreateModal.vue` | Presentational: модалка выбора типа, показывает уже открытые типы (проп `openTypes`) задизейбленными с бейджем "Bereits offen"; эмитит `create(type)`, сам не решает, вызывать ли `createCheckpoint()`. |
| `src/views/CheckpointListPrototypeView.vue` | Главный экран: синтетическая сводная плашка (Kinder/Betreuer, хардкоженные константы), кнопка "Neuen Checkpoint erstellen" (открывает `CheckpointCreateModal`, показывает inline-ошибку при `ALREADY_OPEN`), таблица всех checkpoint'ов за день (Typ-/Status-/Origin-бейджи, клик по строке → маршрут детального экрана по `type`). Определение аномалии (несколько одновременно открытых checkpoint'ов одного типа) считается здесь и передаётся в `CheckpointStatusBadge`. |
| `src/views/CheckpointBusPrototypeView.vue` | Детальный/мониторинговый экран Bus: таблица автобусов (статус-точка, счётчики Kinder/Betreuer, Verantwortliche, один автобус намеренно показывает "Keine Kinder zugeordnet"), разворачиваемый список пакетов на автобус, Finish/Cancel (активны только при `status === OPEN`). |
| `src/views/CheckpointGroupPrototypeView.vue` | Детальный/мониторинговый экран Group: таблица Status/Morgen/Aktuell/Betreuer/Differenz, одна группа без данных, одна с недостающими детьми (разворачиваемый список), все остальные группы "чистые" и по умолчанию свёрнуты (кнопка "N saubere Gruppe(n) anzeigen"), Finish/Cancel. |
| `src/views/CheckpointLazyPrototypeView.vue` | Детальный/мониторинговый экран Lazy: плашка "Letzte Meldung", два списка "Gemeldet"/"Noch nicht gemeldet" (из `useLazyCheckpointProgressMock.js`), Finish/Cancel (без авто-завершения). |

# Реализованные изменения

Реализовано строго по `IMPLEMENTATION_PLAN.md` (все 10 шагов «Плана реализации»):

1. **`useCheckpointsMock.js`** — модель данных, seed-сценарий, все функции (`fetchCheckpointsForDay`/`createCheckpoint`/`finishCheckpoint`/`cancelCheckpoint`/`fetchCheckpointDetail`). Явное создание (`createCheckpoint`) отклоняется, если уже есть открытая точка того же типа (`{ error: 'ALREADY_OPEN', existingId }`), в отличие от seed-сценария, где создание никогда не блокируется программно (seed пишет напрямую в массив). `finishCheckpoint` проставляет `baseline_children_count` только для первой `FINISHED`-точки дня (независимо от типа) — проверено: у Bus-FINISHED (создана первой) baseline стоит, у последующих `finishCheckpoint()`-вызовов через UI — нет.
2. **`useLazyCheckpointProgressMock.js`** — зависит от 1 только по общей идее (не по коду), собственный синтетический ростер "детей без группы", кэш по `checkpointId`.
3. **Presentational-компоненты** — `CheckpointStatusBadge`, `CheckpointTypeBadge`, `CheckpointOriginBadge`, `CheckpointCreateModal` — независимы друг от друга, зависят только от формы объекта из шага 1.
4. **`CheckpointListPrototypeView.vue`** — список/история за день, кнопка создания, сводка (синтетические числа).
5-7. **`CheckpointBusPrototypeView.vue` / `CheckpointGroupPrototypeView.vue` / `CheckpointLazyPrototypeView.vue`** — детальные экраны по типу.
8. **`router/index.js` + `MainView.vue`** — маршруты и кнопка меню, после того как все экраны уже существовали.
9. **Проверки** — см. раздел «Проверки» ниже (ручная проверка в браузере не выполнена в этой сессии, см. там же).
10. **`state.txt`/`dashboard.md`** — обновлены этим отчётом.

Все обязательные состояния из Definition of Done продемонстрированы в seed-данных и достижимы через UI:
- **несколько одновременно открытых типов** — Bus OPEN (#2) и Group OPEN (#3) сосуществуют без предупреждения в списке;
- **аварийное состояние "две открытые одного типа"** — вторая Group OPEN (#4) засеяна рядом с #3, `CheckpointListPrototypeView` вычисляет это и передаёт `anomaly=true` в `CheckpointStatusBadge`, которая рисует отдельный красный чип "Anomalie: mehrere offen"; это состояние недостижимо через `CheckpointCreateModal`/`createCheckpoint()` (проверено кодом — `createCheckpoint()` всегда отклоняет вторую открытую точку того же типа);
- **"создана автоматически (Betreuer X)" vs. "создана администратором"** — `CheckpointOriginBadge`, видно во всех списках/детальных экранах;
- **"нет детей"** — Bus #5 в Bus-checkpoint'ах (`includeEmptyBus`), Gruppe 1 в Group-checkpoint'ах (`hasData: false`);
- **"недостающие дети"** — Gruppe 2 (Differenz > 0, разворачиваемый `missingChildren`);
- **"полностью чисто"** — все остальные группы (`current === morning`), по умолчанию свёрнуты;
- **"ошибка"** — заблокированное создание (inline-alert "ALREADY_OPEN" в списке) и кнопки Finish/Cancel, задизейбленные при `status !== OPEN`.

# Отклонения от плана

Одно техническое упрощение, архитектурно не значимое: по спецификации 130-плана `created_by`/`finished_by`/`cancelled_by` — `bigint`-ссылка на `users.id`. Поскольку у mock-слоя нет настоящей таблицы `users`, а `CheckpointOriginBadge` нужно отображаемое имя, эти поля в моке хранят небольшой объект (`{ id, name, isAdmin }`) вместо голого числа. Это касается только внутренней формы mock-данных, а не имён/сигнатур экспортируемых функций (собственно критерий контракта из плана) — при реальной реализации в 131 это поле в любом случае заменится настоящим join'ом с `users`, независимо от того, как его моделирует mock.

Других содержательных отклонений от `IMPLEMENTATION_PLAN.md` нет.

# Миграции

Нет. Ни одна таблица не создана и не изменена, ни одна RLS-политика не тронута. Прототип не импортирует `@/supabase` ни в одном новом файле.

# Проверки

- `git status --short` — подтверждён ожидаемый набор изменений: `src/router/index.js`, `src/views/MainView.vue` изменены; 4 новых `Checkpoint*PrototypeView.vue`, 2 новых mock-composable, 4 новых presentational-компонента в `src/components/checkpoints-prototype/`. `AdminBusView.vue`, `ChildrenView.vue`, `BusDetailModal.vue`, `GroupDetailModal.vue`, `ResetHistoryPanel.vue`, `useDays.js`, `useBusData.js`, `useGroups.js`, `useScanPackets.js`, `useScanPacket.js`, `stores/config.js` — в списке отсутствуют (не изменены).
- `npm run build` — сборка проходит успешно (354 модуля, без ошибок); появились 4 новых lazy-loaded чанка (`CheckpointListPrototypeView-*`, `CheckpointBusPrototypeView-*`, `CheckpointGroupPrototypeView-*`, `CheckpointLazyPrototypeView-*`), то есть код прототипа не входит в основной бандл, пока прототип не открыт (требование плана, аналог `/headcount`/`/scanner/*`). Предупреждения о версии Node/размере основного чанка/возрасте browserslist — существовавшие ранее, не связаны с этой правкой.
- Статический просмотр кода: ни один новый файл не импортирует `@/supabase`, `supabase.from(...)`, `supabase.rpc(...)` или `supabase.channel(...)` — подтверждено грепом по новым файлам.
- **Ручная проверка в браузере (шаг 9 плана реализации, требование Definition of Done — "убедиться в Network-панели браузера, что не ушло ни одного запроса к Supabase") не выполнена в этой сессии.** Причина: доступ к экрану защищён обычным guard'ом приложения (`requiresAuth && requiresAdmin`), проверяющим роль через реальный Supabase-запрос к таблице `users` — то есть чтобы просто увидеть кнопку меню/открыть маршрут, нужна настоящая admin-сессия против продуктивного Supabase-проекта (`.env` указывает на реальный `prlivcmqjqjypclkcovl.supabase.co`). Использование бутстрап-admin-учётных данных из `doc/users.sql` для интерактивного входа в этой сессии сознательно не выполнено, чтобы не создавать побочные эффекты в продуктивной среде (например, обновление `last_seen_date` при логине) без явного запроса пользователя. Рекомендуется выполнить ручную проверку по чек-листу плана (несколько открытых типов параллельно, auto vs admin created, Finish/Cancel, blocked create, пустой автобус/группа, свернуть чистую группу, Lazy checked-in/not-yet, Network-панель пуста) перед тем, как использовать прототип для согласования UX с командой — по тому же образцу, что и в 116/120/122/126.

# Исправления после ревью

(раздел заполняется по итогам REVIEW_REPORT.md, если ревью потребует правок)

# UX-Feedback и дальнейшая доработка (Runden 1-4)

После первичной реализации прототип прошёл четыре раунда пользовательской
UX-обратной связи (не review, а итеративное согласование интерфейса — сам
смысл этого тикета). Ни один из раундов до сих пор не был отражён в этом
отчёте — фиксируется задним числом одним разделом.

**Runde 1** — первая обратная связь после демонстрации:
- Page 1 (`CheckpointListPrototypeView`): таблица заменена карточным списком
  (не помещалась в ширину экрана, вынуждала скроллить); "Erstellt von"
  убран из списка (остался только в детальном экране); шрифты/кнопки
  увеличены (работа в поле/перчатки/солнце).
- "Cancel" воспринимался как путающий (визуально похож на "Abgeschlossen",
  но оставался в списке) — заменён двумя явными действиями:
  `reopenCheckpoint()` (противоположность finish, для случайного закрытия) и
  `removeCheckpoint()` (полностью убирает ошибочно созданную точку из
  списка, в архив). `CHECKPOINT_STATUS` лишился `CANCELLED`.
- Page 2 (Bus): многострочная шапка; таблица автобусов → карточная сетка
  (автобус может иметь > 8 Betreuer — Bus 1 демонстрирует это явно);
  раскрывающаяся панель с Betreuer/Kinder/временем сканирования на
  автобус, с копированием в буфер обмена.
- Page 3 (Group): многострочная шапка; таблица групп → карточная сетка
  (добавлен кейс "детей больше, чем утром"); раскрывающаяся панель для
  недостающих детей выбранной группы.
- Page 4 (Lazy): при ~150 детях плоский список нечитаем — "Gemeldet"
  показывает порядковый номер/группу/время построчно, "Noch nicht
  gemeldet" сгруппирован по группам вместо одного длинного списка.

**Runde 2** — уплотнение и вложенное раскрытие:
- Page 1 EL4: карточка структурирована на шапку (номер+тип) / тело
  (время начала-конца) / подвал (статус+аномалия) вместо обобщённой
  двухстрочной карточки; открытые точки выделены цветом, закрытые —
  намеренно приглушены; аномалия — отдельная строка в подвале, а не
  дополнительный бейдж рядом со статусом.
- Page 2/3/4: статус и кнопка Schließen/Öffnen — в одну строку вместо
  полноширинных кнопок; Entfernen — маленькая иконка рядом с заголовком.
- Page 2: счётчики Kinder/Betreuer раскрашены (синий/красный) и увеличены;
  детальная панель автобуса раскрывается прямо внутри его карточки
  (`grid-column: 1 / -1`), а не отдельным блоком под всей сеткой; дети
  показывают номер своей группы (защита от совпадения имён).
- Page 3: карточная сетка заменена аккордеоном — группы без проблем
  остаются компактной строкой, группы с недостающими/лишними детьми
  занимают всю ширину и разворачиваются по клику "на месте".

**Runde 3** — результат вместо только статуса/времени:
- Page 1 EL4 и Page 2/3/4 EL2: карточка/шапка теперь сразу показывают
  итог (Kinder/Betreuer-сумма для BUS; anwesend/gesamt для GROUP/LAZY) и
  отклонение от базы дня ("N fehlen"/"N mehr"), если база уже установлена.
- Модель базы дня переведена с захардкоженной константы
  (`MOCK_BASELINE_CHILDREN_COUNT = 42`, нигде фактически не читавшейся) на
  реально вычисленное значение: первая закрытая точка дня фиксирует
  собственное посчитанное число присутствующих детей
  (`baseline_children_count`), все последующие точки сравниваются с ней
  через `getDayBaseline()`.
- Закрытие точки (`finishCheckpoint`) теперь предупреждает через
  `checkpointHasOpenIssues()` + `confirm()`, если есть недостающие дети/
  автобусы или группы без данных — раньше закрывалось без предупреждения.
- Списки присутствующих/отсутствующих детей стали копируемыми в буфер
  обмена (карточка "Kinder gesamt" на Page 2/3, кнопки "Kopieren" на
  Page 4) — список отсутствующих визуально выделен (красный фон).
- Багфикс Page 3: аккордеон групп разворачивался только для групп с
  недостающими детьми — клик по "чистой" или "детей больше" группе
  визуально ничего не раскрывал; исправлено, разворачивается любая группа.
- Сознательно отложено (по формулировке пользователя "в дальнейшем
  желательно") — указание причины отсутствия ребёнка (заболел/уже на
  месте/приехал отдельно/другое) с сохранением в `checkpoints.description`
  — задача для 131 (реальная БД/схема), не для UI-мока.

**Runde 4** — переход от экранного к сущностному дизайну (архитектурный
раунд, крупнейший после первичной реализации): вместо того, чтобы каждый
экран заново отображал детей/Betreuer/группы по-своему, введена единая
модель "одна сущность — один компонент отображения — один маршрут":

- Новые канонические mock-справочники с реальной стабильной id (раньше
  дети/Betreuer идентифицировались только по имени/позиции в массиве):
  `useMockConstants.js`, `useChildEntityMock.js` (24 ребёнка, id 1-24,
  дополнены выдуманными, но детерминированными полями — возраст, родители,
  телефон, Schwimmabzeichen, Armband, заметки — по образцу реального
  `ChildDetailView.vue`), `useBetreuerEntityMock.js` (12 Betreuer, id
  101-112, email/телефон). Отдельный пул детей у Lazy (`LAZY_CHILD_POOL`,
  дублировавший id 1-12 независимо от основного пула) удалён — Lazy
  использует общий 24-детский ростер (заодно устранена рассинхронизация:
  итог `summarizeCheckpoint()` у GROUP был 24, у LAZY — 12).
- `useCheckpointsMock.js`: автобусы/группы теперь ссылаются на детей/
  Betreuer по id (`{id,name}`), а не по голым строкам; добавлены
  `getDayBaselineCheckpoint()` (сама точка-база дня, не только число),
  `getBusDelta()`/`getGroupDelta()` (отклонение конкретного автобуса/
  группы от базы дня, с явным `hasComparison:false` при несопоставимых
  типах вместо падения), `getCheckpointBetreuerList()`,
  `getBetreuerTodayAssignment()`.
- Новые сквозные сущности: `useScanHistoryMock.js` (история сканирований
  ребёнка за день, синтезирована из уже существующих Bus/Group/Lazy-данных,
  без новой случайности) и `useGroupEntityMock.js` (сквозной по дню взгляд
  на группу — ростер, Betreuer, текущий результат, история дня).
- Новые переиспользуемые компоненты: `ChildLink`/`BetreuerLink`/
  `GroupLink` (кликабельное имя → карточка сущности), `CountLink`
  (кликабельная цифра-ссылка), `EntityListCard` (один и тот же список для
  любой пары "дети/Betreuer × откуда открыт").
- Новые экраны и маршруты под `/admin/checkpoints-prototype/`: `/list`
  (универсальный список, управляется query-параметрами
  `kind/scope/scopeId/checkpointId/filter`), `/child/:id` +
  `/child/:id/edit` (функциональное mock-редактирование — без персистенции,
  меняет только reactive-объект в памяти), `/betreuer/:id`,
  `/group-entity/:id` (отдельно от уже существующего, привязанного к
  конкретной точке `/group/:id`).
- Page 2/3/4 переработаны: убраны разворачивающиеся на месте панели и
  инлайновые списки-копии из Runde 3 (сама возможность копирования
  сохранена, но теперь на один клик дальше — в `EntityListCard`); счётчики
  и имена теперь кликабельны и ведут к соответствующим сущностным экранам;
  добавлены бейджи отклонения по конкретному автобусу/группе
  (`getBusDelta`/`getGroupDelta`), которых раньше не было (только
  агрегированное отклонение по всей точке).
- `npm run build` проходит без ошибок; грепом подтверждено отсутствие
  ссылок на удалённые `CHILD_NAMES`/`LAZY_CHILD_POOL`/`BETREUER_NAME_POOL`/
  старые строковые `betreuerNames` вне исторических комментариев.
- **Ручная проверка в браузере не выполнена** — в этой сессии недоступен
  инструмент браузерной автоматизации (как и в 116/120/122/126/130_2
  Phase 1). Рекомендуется пройти всю цепочку переходов (список →
  Checkpoint → Bus/Group-карточка → список детей → карточка ребёнка →
  редактирование → история сканирований → карточка Betreuer → карточка
  группы) вручную перед использованием прототипа для дальнейшего
  UX-согласования.
