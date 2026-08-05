# Измененные файлы

- `doc/db/checkpoints_baseline_confirm.sql` (новый файл, применяется
  вручную через Supabase SQL Editor — не применён в рамках этой сессии,
  ассистент не имеет прямого доступа к боевой БД).
- `src/composables/useSupabaseCheckpoints.js`
- `src/composables/useCheckpoints.js`
- `src/composables/useLazyCheckpointProgress.js`
- `src/views/CheckpointBusView.vue`
- `src/views/CheckpointGroupView.vue`
- `src/views/CheckpointLazyView.vue`
- `vault/02-Предметная-область/Checkpoint.md`
- `CLAUDE.md`

# Новые файлы

- `doc/db/checkpoints_baseline_confirm.sql`

# Реализованные изменения

## 1. Где хранить `presentRoster` — решение зафиксировано в коде

Как и решено в `IMPLEMENTATION_PLAN.md`: **не** `children_today` (это
"храповик", не сбрасывается в течение дня — см. обоснование уже в плане),
**не** новая таблица. `presentRoster` вычисляется по требованию новой
функцией `getDayPresentRosterIds(day)` (`useCheckpoints.js`) из тех же
`scan_packets`/`scans`, что и `baseline_children_count` — той же выборки,
отфильтрованной по `checkpoint_id` дневной Baseline-точки
(`getDayBaselineCheckpoint()`, уже существовала).

## 2. DB: `doc/db/checkpoints_baseline_confirm.sql`

- `finish_checkpoint(p_id, p_set_baseline boolean default true)` — шаг 2
  (фиксация Baseline) теперь под `IF p_set_baseline THEN ... END IF`;
  `DEFAULT true` сохраняет обратную совместимость.
- Новая `set_checkpoint_baseline(p_id)` — явная отложенная фиксация на уже
  закрытой точке; тот же admin-чек, требует `status = 2` (иначе
  `NOT_FINISHED`), требует отсутствия Baseline у дня (иначе
  `BASELINE_ALREADY_SET`).
- RLS не менялся — обе функции `SECURITY DEFINER`, как и остальные RPC
  `checkpoints`.

## 3. `useSupabaseCheckpoints.js`

- `rpcFinishCheckpoint(id, setBaseline = true)` — передаёт `p_set_baseline`.
- Новая `rpcSetCheckpointBaseline(id)`.

## 4. `useCheckpoints.js`

- Новая `getDayPresentRosterIds(day)` — экспортирована.
- `getBusChildrenBreakdown(cp)` — переписана: `present` — фактически
  отсканированные дети (не зависит от Baseline), `absent` — пересечение
  `presentRoster` с "кого нет среди present"; при отсутствии Baseline
  (`getDayPresentRosterIds()` вернул `null`) — `absent: []`.
- `getGroupChildrenBreakdown(cp)` — переписана: убраны N запросов
  `getChildrenByGroup()` в цикле в пользу одного `fetchAllChildren()` +
  фильтр в JS (как в `buildBusesForCheckpoint()`/
  `buildGroupsForCheckpoint()`). "Нулевые" группы (`!hasData`) добавляют в
  `absent` только пересечение своего состава с `presentRoster`, а не весь
  состав целиком.
  - **Важное уточнение сверх буквального текста плана**: `present`/
    `absent` не могут быть корректно восстановлены из
    `group.missingChildren` "дополнением" (`roster \ missingChildren`),
    как это делал старый код, — после того как `missingChildren` сам стал
    presentRoster-относительным (см. п. `buildGroupsForCheckpoint` ниже),
    такое дополнение включило бы в "present" детей, которые вообще не
    из `presentRoster` и не отсканированы. Поэтому `buildGroupsForCheckpoint()`
    дополнительно возвращает `presentChildIds` (реальные id
    отсканированных детей последнего пакета группы) — новое поле группы,
    используемое только внутри `getGroupChildrenBreakdown()`, не влияет на
    существующие потребители (`CheckpointGroupView.vue`,
    `checkpointHasOpenIssues()`, `fetchGroupEntity()` читают только уже
    существовавшие поля).
- `buildGroupsForCheckpoint(checkpointId, totalGroups, day)` — получил
  третий параметр `day`; `morning`/`missingChildren` считаются от
  `presentRoster` дня, если он есть, иначе (нет Baseline) — от полного
  состава группы, как и раньше (единственный доступный ориентир, план,
  риск №3).
- `attachTypeData()` — передаёт `cp.day` в `buildGroupsForCheckpoint()`.
- `finishCheckpoint(id, setBaseline = true)` — передаёт флаг в RPC.
- Новая `setCheckpointBaseline(id)`.
- `translateRpcError()` — добавлен код `BASELINE_ALREADY_SET` в общую ветку
  с `NOT_OPEN`/`NOT_FINISHED`/`NOT_FOUND`/`NOT_ADMIN`.
- Default-экспорт дополнен `setCheckpointBaseline`, `getDayPresentRosterIds`.

## 5. `useLazyCheckpointProgress.js`

- `fetchLazyCheckpointProgress(checkpointId)` — сначала читает строку
  точки (`fetchCheckpointRowById`), чтобы получить `day`; `notYet`
  пересекается с `presentRoster` дня (пусто, если Baseline ещё нет).
- **Отклонение от буквального текста плана**: `getDayPresentRosterIds()`
  из `useCheckpoints.js` не импортирована — вместо этого добавлена
  приватная копия той же логики (`getPresentRosterIds()`, ~7 строк,
  переиспользует уже импортированные `fetchCheckpointRowsForDay`/
  `fetchScanPacketsForCheckpoint`/`fetchScansForPacketIds` из
  `useSupabaseCheckpoints.js`). Причина: `useCheckpoints.js` импортирует
  `fetchLazyCheckpointProgress` ИЗ `useLazyCheckpointProgress.js`
  (однонаправленная зависимость); обратный импорт создал бы циклическую
  зависимость между двумя composables. Небольшое дублирование ~7 строк
  сочтено безопаснее цикла между модулями — архитектурное решение
  принято мной как минимальный безопасный вариант в рамках уже описанного
  в плане модуля, не является отдельным архитектурным изменением.
- Обновлён шапочный комментарий файла (был неточен про "полный роster").

## 6. Три вью (`CheckpointBusView.vue`, `CheckpointGroupView.vue`, `CheckpointLazyView.vue`)

Во всех трёх — идентичный паттерн, как в плане:

- `onFinish()` — если `resultSummary.value && !resultSummary.value.hasBaseline`,
  запрашивает подтверждение (`confirm()`) с текстом *"Soll die aktuelle
  Liste der anwesenden Kinder als Tagesreferenz festgehalten werden?"*;
  отказ передаётся как `setBaseline = false` в `finishCheckpoint()`, но
  **не блокирует** закрытие точки.
- Новая кнопка «Als Tagesreferenz festhalten» в блоке статуса,
  `v-if="checkpoint.status === FINISHED && resultSummary && !resultSummary.hasBaseline"`,
  вызывает `setCheckpointBaseline()` → `load()`.
- Новая ветка в блоке `actionError` для кода `BASELINE_ALREADY_SET`.
- Скрытие "Fehlend":
  - `CheckpointBusView.vue`/`CheckpointGroupView.vue` — карточка
    "Kinder & Betreuer gesamt": `CountLink` с `label="Fehlend"` теперь
    `v-if="resultSummary?.hasBaseline"`.
  - `CheckpointGroupView.vue` — построчные "fehlen"/"mehr"/"OK" в каждой
    группе теперь внутри `<template v-if="resultSummary?.hasBaseline">`
    (при отсутствии Baseline строка группы показывает только счётчик
    "Kinder", без статуса).
  - `CheckpointLazyView.vue` — вся карточка "Noch nicht gemeldet" теперь
    `v-if="resultSummary?.hasBaseline"` (при отсутствии Baseline
    `notYet` всё равно пуст из-за п. 5, но без скрытия карточки был бы
    виден обманчивый текст "Alle haben sich gemeldet.").
  - Верхний `cp-result-row-final` блок (`missing`/`extra` относительно
    `baseline_children_count`) не требовал изменений — эти поля уже равны
    0 без Baseline (`summarizeCheckpoint()`, не менялась), блок и раньше
    самостоятельно скрывался через `missing > 0 || extra > 0`.

## 7. Документация

- `vault/02-Предметная-область/Checkpoint.md`: раздел
  "Missing/Extra/Comparison" — `getBusChildrenBreakdown()`/
  `getGroupChildrenBreakdown()` описаны как relative к `presentRoster`
  (не полному Roster), с явным упоминанием скрытия "Fehlend" без Baseline
  и связи с аудитом тикета 146. Раздел "Baseline присутствия" — дополнен
  описанием подтверждающего диалога, кнопки "Als Tagesreferenz
  festhalten" и обоснованием, почему `children_today` не годится для
  `presentRoster` (перенесено из плана).
- `CLAUDE.md`: добавлен пункт в разделе "Стек" — целевой экран iPhone 12
  (390×844 CSS px), не desktop.

# Отклонения от плана

1. **`useLazyCheckpointProgress.js` не импортирует `getDayPresentRosterIds`
   из `useCheckpoints.js`** (см. п. 5 выше) — во избежание циклической
   зависимости между модулями; вместо этого локальная копия той же
   логики. План этого явно не запрещал и не предписывал конкретный
   механизм импорта, детали оставлены на реализацию — решение принято
   мной как архитектурно нейтральное (не меняет слоистую структуру,
   не добавляет новую зависимость между composables).
2. **`buildGroupsForCheckpoint()` возвращает новое поле `presentChildIds`
   на каждой группе** (см. п. 4 выше) — план не называл это поле явно, но
   без него `getGroupChildrenBreakdown()` не может корректно определить
   "Anwesend" после того, как `missingChildren` стал presentRoster-
   относительным (иначе дети, никогда не приходившие в этот день и не
   входящие в `presentRoster`, ошибочно попадали бы в "Anwesend"). Это
   дополнительное поле, не удаление/замена существующих — потребители,
   читающие только старые поля группы, не затронуты.
3. **`vault/03-База-данных/checkpoints.md` не обновлён**, хотя таблица RPC
   там (`finish_checkpoint(id)`) устарела (новый параметр
   `p_set_baseline`, не описана `set_checkpoint_baseline()`). План
   явно ограничивал документацию только `vault/02-Предметная-область/
   Checkpoint.md` и `CLAUDE.md` — оставлено как есть, чтобы не расширять
   объём задачи сверх плана. Явно фиксирую здесь как известный разрыв
   документации на будущее.
4. Групповая (per-group) цветовая раскраска карточек в
   `CheckpointGroupView.vue` (`groupCardClass()` — фон "ok"/"missing"/
   "extra"/"none") **не гейтится** флагом `hasBaseline` — план явно просил
   скрыть только "Fehlend"-блоки (числа/текст "fehlen"/"mehr"), про фон
   карточек речи не было; технически до появления Baseline `morning`
   всё ещё равен полному составу группы (запасной вариант, риск №3
   плана), поэтому фон может показывать "missing"/"extra" даже без
   видимого числа. Не исправлено — сочтено отдельным, не запрошенным
   изменением дизайна.

В остальном реализация строго соответствует
`IMPLEMENTATION_PLAN.md` (шаги 1–7 «План реализации»; шаг 8 — ручная
проверка на устройстве — вне этой сессии, см. «Проверки»).

# Миграции

`doc/db/checkpoints_baseline_confirm.sql` — **не применена** к боевой БД
в рамках этой сессии (ассистент не имеет доступа к Supabase SQL Editor).
Требуется ручное применение пользователем перед использованием новых
возможностей (подтверждение Baseline, кнопка "Als Tagesreferenz
festhalten") — до применения `finish_checkpoint()` продолжит работать по
старой сигнатуре недоступной (функция ещё не заменена), т.е. клиентский
код, вызывающий `finish_checkpoint(p_id, p_set_baseline)` с двумя
параметрами, получит ошибку от Postgres, пока миграция не применена.
Безопасна к повторному запуску (`CREATE OR REPLACE FUNCTION`).

# Исправления после ревью

Исправлены оба пункта из `REVIEW_REPORT.md` → «Список обязательных
исправлений». Три пункта из «Список необязательных улучшений»
(`groupCardClass()` без `hasBaseline`, дублирующиеся запросы в
breakdown-функциях, обновление `vault/03-База-данных/checkpoints.md`,
усиление `finish_checkpoint()` против гонки администраторов) не
затронуты — как и раньше в этой серии тикетов (см. `tickets/142/
REVIEW_REPORT.md`), необязательные улучшения оставлены вне объёма
багфикса.

## 1. Critical — бесконечная рекурсия в `getDayPresentRosterIds()`

`getDayPresentRosterIds(day)` (`useCheckpoints.js`) больше не вызывает
`getDayBaselineCheckpoint(day)` (который тянет **полный**
`fetchCheckpointDetail()` → `attachTypeData()` → для GROUP
`buildGroupsForCheckpoint()` → снова `getDayPresentRosterIds(day)`).
Вместо этого — прямой лёгкий поиск Baseline-строки через уже
импортированную `fetchCheckpointRowsForDay(day)` (тот же паттерн, что
уже был в приватной копии `getPresentRosterIds()` в
`useLazyCheckpointProgress.js`, которая рекурсии не подвержена).
Цикл разорван: если Baseline-точка дня — GROUP, повторного вызова
`getDayPresentRosterIds()` больше не возникает.

`getDayBaselineCheckpoint()` (использующая полный
`fetchCheckpointDetail()`) сохранена без изменений — она по-прежнему
используется `getDayBaseline()`/`getBusDelta()`/`getGroupDelta()`, но
эти вызовы больше не образуют цикл, так как внутренний
`getDayPresentRosterIds()` в `buildGroupsForCheckpoint()` её больше не
вызывает.

## 2. Major — `checkpointHasOpenIssues()` для GROUP игнорировал отсутствие Baseline

`checkpointHasOpenIssues(cp)` для `CHECKPOINT_TYPE.GROUP` теперь сначала
проверяет `getDayPresentRosterIds(cp.day)`: если `null` (день ещё без
Tagesbasis), `missingTotal` принудительно `0` — диалог «Schließen» на
первой перекличке дня больше не показывает «N Kinder fehlen» на основе
непоказательного полного состава группы (тот же `missingChildren`,
который тикет 147 явно называет ненужным до фиксации Baseline).
`noDataGroups`-часть сообщения не тронута — она не зависит от Baseline.
Выбран вариант «занулить», а не «явно задокументировать как принятое
отклонение» — это прямое следствие явного требования тикета («fehlend
не нужен даже в первой перекличке»), не новое архитектурное решение,
требующее согласования с заказчиком.

# Измененные файлы

- `src/composables/useCheckpoints.js` — `getDayPresentRosterIds()`,
  `checkpointHasOpenIssues()`.

# Проверки

- `npm run build` — пройден успешно, сборка завершилась без ошибок (те же
  неизменные предупреждения о размере чанка `index-*.js` и устаревших
  `caniuse-lite`/`baseline-browser-mapping` данных — не связаны с этой
  правкой).
- Прочитан итоговый код всех изменённых файлов после правок — сверено,
  что:
  - `getBusChildrenBreakdown()`/`getGroupChildrenBreakdown()`/
    `buildGroupsForCheckpoint()`/`fetchLazyCheckpointProgress()`
    сравнивают с `presentRoster`, а не с полным Roster (Definition of
    Done, план).
  - "Fehlend"-блоки во всех трёх вью скрыты при `!resultSummary.hasBaseline`.
  - `onFinish()` показывает подтверждение только когда день ещё без
    Baseline; отказ не блокирует закрытие (передаёт `setBaseline=false`,
    но всё равно вызывает `finishCheckpoint()`).
  - Кнопка "Als Tagesreferenz festhalten" видна только на закрытой точке
    без Baseline дня.
- **Ручная проверка на устройстве** (реальный сценарий: закрыть первую
  точку дня, отказаться от Baseline в диалоге, зафиксировать его позже
  второй точкой кнопкой "Als Tagesreferenz festhalten", убедиться что
  "Fehlend" не показывается до фиксации и корректен после) — **не
  выполнена** в рамках этой сессии, как и во всех предыдущих тикетах
  серии Checkpoint (нет доступа к браузеру/устройству у ассистента).
  Требует применения SQL-миграции пользователем как предпосылки.

## После исправлений ревью

- `npm run build` — повторно пройден успешно после обеих правок
  (`getDayPresentRosterIds()`, `checkpointHasOpenIssues()`), без новых
  ошибок/предупреждений.
- Прочитан итоговый код `getDayPresentRosterIds()`,
  `getDayBaselineCheckpoint()`, `buildGroupsForCheckpoint()`,
  `attachTypeData()`, `checkpointHasOpenIssues()` — подтверждено, что
  цепочка `getDayPresentRosterIds()` → `getDayBaselineCheckpoint()` →
  `fetchCheckpointDetail()` → `attachTypeData()` →
  `buildGroupsForCheckpoint()` → `getDayPresentRosterIds()` разорвана:
  новая версия `getDayPresentRosterIds()` использует только
  `fetchCheckpointRowsForDay()`, не вызывает `fetchCheckpointDetail()`.
- **Ручная проверка на устройстве** сценария из Critical-находки (первая
  закрытая точка дня — GROUP-тип, становится Baseline, после этого
  открыть список чекпоинтов дня и любую из трёх detail-вью) — **не
  выполнена** в рамках этой сессии (нет доступа к устройству/браузеру у
  ассистента); как и указано выше, требует предварительного применения
  SQL-миграции.
