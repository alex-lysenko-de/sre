# Итог

CHANGES_REQUIRED

# Critical

## 1. Бесконечная рекурсия в `getDayPresentRosterIds()`/`getDayBaselineCheckpoint()`/`buildGroupsForCheckpoint()`, если Baseline дня — GROUP-точка

`useCheckpoints.js:403` (`getDayPresentRosterIds`) вызывает `getDayBaselineCheckpoint(day)`
(`useCheckpoints.js:382`), которая при найденной строке-Baseline вызывает
**полный** `fetchCheckpointDetail(baselineRow.id)` (нужен только `.id`, а
получаем целый декорированный объект). `fetchCheckpointDetail()` вызывает
`attachTypeData()` (`:209`), которая для `type === GROUP` вызывает
`buildGroupsForCheckpoint(cp.id, totalGroups, cp.day)` (`:161`) — а та (уже
в рамках тикета 147) сама вызывает `getDayPresentRosterIds(day)` (`:165`).

Если Baseline-точка дня имеет тип **GROUP**, получается замкнутый цикл без
условия останова:

```
fetchCheckpointDetail(X)
  → attachTypeData(X)                      [X.type === GROUP]
  → buildGroupsForCheckpoint(X.id, ..., X.day)
  → getDayPresentRosterIds(X.day)
  → getDayBaselineCheckpoint(X.day)          [baselineRow.id === X.id]
  → fetchCheckpointDetail(X.id)              ← та же самая точка снова
  → ... до бесконечности
```

Каждый виток — реальный сетевой обмен с Supabase (не переполнение
синхронного стека, а бесконечная последовательность запросов), поэтому
промис никогда не резолвится: экран крутит спиннер вечно, а бэкенд
получает нескончаемый поток запросов.

**Масштаб поражения** — не только `CheckpointGroupView.vue`:

- `fetchCheckpointsForDay(day)` (`:226`, список чекпоинтов дня — главный
  админ-экран) вызывает `attachTypeData()` для **каждой** строки дня
  (`:235`) — если хотя бы одна из них GROUP-типа и является Baseline дня,
  весь список зависает.
- `fetchCheckpointDetail()` для **любого** чекпоинта (Bus/Group/Lazy) в
  этот день зависает через `summarizeCheckpoint()` → `getDayBaseline()` →
  `getDayBaselineCheckpoint()` (используется в `load()` всех трёх вью).
- `getBusChildrenBreakdown()`/`getGroupChildrenBreakdown()` (новый код
  этого тикета) — то же самое напрямую.

**Конкретный сценарий отказа**: первая закрытая точка дня — GROUP,
администратор подтверждает Tagesreferenz (или фиксирует её позже кнопкой
«Als Tagesreferenz festhalten»). С этого момента `baseline_children_count`
у этой GROUP-точки заполнен — и весь раздел Checkpoints для этого дня
(список + все три вида детальных экранов) перестаёт открываться:
бесконечный цикл сетевых запросов, зависший UI. `reopen_checkpoint()`
(`doc/db/checkpoints.sql`) не сбрасывает `baseline_children_count`, так что
проблема не самоустраняется откатом точки — день остаётся сломанным до
правки кода или ручной правки БД.

Один из трёх типов чекпоинтов (GROUP) — совершенно обычный кандидат на
первую точку дня, так что это не экзотический edge-case, а вероятный
регулярный сценарий сразу после выкладки.

**Требуется правка до мержа**: `getDayPresentRosterIds()` должен получать
`id` Baseline-чекпоинта лёгким способом (например, напрямую из
`fetchCheckpointRowsForDay()`, как это уже сделано в приватной копии
`getPresentRosterIds()` в `useLazyCheckpointProgress.js` — та копия
проблеме не подвержена именно потому, что не вызывает
`fetchCheckpointDetail()`), а не через тяжёлый
`fetchCheckpointDetail()`/`attachTypeData()`.

Примечательно, что баг уже присутствовал в псевдокоде
`IMPLEMENTATION_PLAN.md` (строки 66-73) — это не отклонение разработчика от
плана, а дефект самого плана, перенесённый в реализацию как есть.

# Major

## 2. «Fehlend не нужен даже в первой перекличке» соблюдено не во всех местах UI

Тикет прямо требует: «Даже в первой перекличке дня информация об
отсутствующих не нужна». Видимые ярлыки «Fehlend»/«fehlen»/«mehr» во всех
трёх вью корректно скрыты через `resultSummary?.hasBaseline`, но два
смежных места используют старый (не привязанный к presentRoster)
fallback-расчёт и потому противоречат этому требованию:

- **`checkpointHasOpenIssues()`** (`useCheckpoints.js:452-461`) для GROUP
  считает `missingTotal` из `group.missingChildren.length`, который до
  появления Baseline по-прежнему равен полному составу группы минус
  отсканированные (тот самый `n = roster - checkedRoster`, который тикет
  явно называет «не нужно вообще»). Значит диалог закрытия первой точки
  дня («Schließen») всё ещё может показать «N Kinder fehlen, trotzdem
  schließen?» с бессмысленным числом до фиксации Baseline.
- **`groupCardClass()`** (`CheckpointGroupView.vue:173-176`) красит карточку
  группы в ok/missing/extra тем же нефильтрованным `morning`/`current`, не
  проверяя `hasBaseline` — карточка может выглядеть «missing» (оранжевый/
  красный фон), пока рядом с ней текстовая метка «fehlen» уже скрыта
  (`v-if="resultSummary?.hasBaseline"`). Визуальное противоречие на одном
  экране: число спрятано, а цветовой сигнал тревоги — нет.

Оба случая осознанно задокументированы разработчиком как принятые
ограничения (план, «Риски», п.3; отчёт, «Отклонения от плана», п.4), но по
факту оставляют требование выполненным лишь частично — решение об этом
компромиссе стоит явно согласовать с заказчиком, а не оставлять как
implementation detail.

# Minor

- Дублирующиеся сетевые запросы в рамках одной загрузки экрана:
  `getBusChildrenBreakdown()`/`getGroupChildrenBreakdown()` вызывают
  `fetchAllChildren()` и `getDayPresentRosterIds()` независимо от того, что
  тот же `cp` уже был декорирован `attachTypeData()`/
  `buildGroupsForCheckpoint()` мгновением раньше с тем же самым
  `fetchAllChildren()`/`getDayPresentRosterIds()` внутри. Паттерн не новый
  (существовал и раньше), но тикет 147 добавляет ещё один
  `getDayPresentRosterIds()`-вызов на каждую breakdown-функцию — после
  фикса Critical-находки эти вызовы уже не будут рекурсивными, но
  по-прежнему избыточны с точки зрения количества запросов на экран.
- Небольшое дублирование логики между `getDayPresentRosterIds()`
  (`useCheckpoints.js`) и приватной `getPresentRosterIds()`
  (`useLazyCheckpointProgress.js`) — осознанно принято разработчиком ради
  избежания циклического импорта (см. отчёт, п.5/«Отклонения», п.1).
  Иронично, что именно LAZY-копия оказалась технически корректнее (не
  подвержена Critical-багу выше) — стоит после фикса привести обе
  реализации к единому (лёгкому) виду.
- `vault/03-База-данных/checkpoints.md` не обновлён под новую сигнатуру
  `finish_checkpoint(p_id, p_set_baseline)` и новую `set_checkpoint_baseline()`
  — явно зафиксировано разработчиком как принятое ограничение объёма
  (план ограничивал документацию только `Checkpoint.md`/`CLAUDE.md`), но
  оставляет документ устаревшим.

# Архитектурные замечания

- Риск №1 плана («гонка двух администраторов... обрабатывается кодом
  `BASELINE_ALREADY_SET`») верен только для нового отложенного пути
  `set_checkpoint_baseline()`. Путь `finish_checkpoint()` (используемый при
  подтверждающем диалоге на Schließen) **не** получил аналогичной защиты —
  не бросает `BASELINE_ALREADY_SET`, использует ту же TOCTOU-проверку
  (`SELECT NOT EXISTS ...` без `FOR UPDATE`/advisory lock), что и до этого
  тикета. Под READ COMMITTED два одновременных `Schließen` разных точек
  одного дня теоретически могут оба пройти проверку `v_is_first_of_day` и
  оба записать `baseline_children_count`, молча нарушив инвариант «один
  Baseline на день». Сама уязвимость не новая (была в исходном
  `finish_checkpoint()` ещё до 147), но формулировка плана вводит в
  заблуждение, будто она уже закрыта — стоит поправить документацию и,
  отдельным тикетом, рассмотреть усиление блокировкой.
- `getDayPresentRosterIds()`, получающий полностью декорированный объект
  чекпоинта только ради поля `.id`, — пример того, как инстинкт
  «переиспользовать существующую функцию» из плана скрыл реальную
  стоимость вызова и стал прямой причиной Critical-находки выше.

# Рекомендации

- Исправить `getDayPresentRosterIds()` на лёгкий поиск id Baseline-точки
  через `fetchCheckpointRowsForDay()` (как в приватной копии для LAZY) —
  это одновременно устраняет рекурсию и убирает лишний round-trip.
- Явно решить с заказчиком, должны ли `checkpointHasOpenIssues()` (GROUP) и
  `groupCardClass()` тоже учитывать отсутствие Baseline — сейчас частично
  нарушается требование «fehlend не нужен даже в первой перекличке».
- Перед закрытием тикета: применить SQL-миграцию к боевой БД и выполнить
  ручную проверку на устройстве из Definition of Done — но только после
  фикса Critical-находки, иначе проверка на реальных данных с GROUP-
  Baseline воспроизведёт зависание.
- Обновить `vault/03-База-данных/checkpoints.md` под новую сигнатуру RPC.

# Список обязательных исправлений

1. Устранить бесконечную рекурсию `getDayPresentRosterIds()` /
   `getDayBaselineCheckpoint()` / `buildGroupsForCheckpoint()` для дней, чья
   Baseline-точка имеет тип GROUP (см. Critical).
2. Согласовать и привести к единому поведению `checkpointHasOpenIssues()`
   для GROUP относительно отсутствия Baseline (см. Major, п.1) — либо
   скрыть/занулить сообщение о «fehlenden Kindern» до фиксации Baseline,
   либо явно задокументировать, что это осознанно оставлено иначе, чем
   того требует буквальный текст тикета.

# Список необязательных улучшений

1. Привязать `groupCardClass()` к `hasBaseline`, чтобы фон карточки не
   противоречил скрытому текстовому «Fehlend».
2. Сократить дублирующиеся запросы `fetchAllChildren()`/
   `getDayPresentRosterIds()` в рамках одной загрузки экрана.
3. Обновить `vault/03-База-данных/checkpoints.md`.
4. Рассмотреть усиление `finish_checkpoint()` против гонки двух
   администраторов (по аналогии с `set_checkpoint_baseline()`), либо
   поправить формулировку плана о том, что эта гонка уже обработана.
