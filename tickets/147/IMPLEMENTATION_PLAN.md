# Цель

Привести `useCheckpoints.js` в соответствие с уже существующим описанием
в `vault/02-Предметная-область/Checkpoint.md`: "fehlend"/missing должен
вычисляться относительно `presentRoster` (список детей, зафиксированный
по первой завершённой контрольной точке дня), а не относительно полного
`Roster` (все когда-либо зарегистрированные дети). Плюс: сделать
фиксацию `presentRoster` осознанным, подтверждаемым действием
администратора, а не молчаливым побочным эффектом закрытия точки. Плюс:
зафиксировать мобильный (iPhone) экран как целевой для дизайна.

# Анализ текущей архитектуры

## Где сейчас расходится код и документ

`vault/02-Предметная-область/Checkpoint.md` ("Missing/Extra/Comparison")
уже честно документирует расхождение:

- `summarizeCheckpoint()` — `missing`/`extra` считаются от
  `baseline_children_count` (дневного Baseline) — **корректно**.
- `getBusDelta()`/`getGroupDelta()` — отклонение конкретного
  автобуса/группы от Baseline-точки — **корректно**.
- `getBusChildrenBreakdown()`/`getGroupChildrenBreakdown()`
  (`useCheckpoints.js:427-438`, `:440-463`) — "Anwesend"/"Fehlend"
  относительно **полного `Roster`** (`fetchAllChildren()`/
  `getChildrenByGroup()`) — здесь и есть баг, который описывает
  заказчик: ребёнок, который просто не приехал сегодня, ничем не
  отличим от ребёнка, который был на Baseline-точке и потерялся.
- `buildGroupsForCheckpoint()` (`:150-190`) — поле `morning` (по смыслу
  должно быть "сколько детей было на утренней/Baseline точке") на деле
  равно `groupRoster.length` — размеру **всего состава группы**,
  независимо от каких-либо реальных перекличек. `missingChildren`
  считается от этого же полного состава.
- `fetchLazyCheckpointProgress()` (`useLazyCheckpointProgress.js:22-65`)
  — `notYet` = `roster.filter(c => !checkedInByChild.has(c.id))`, где
  `roster = fetchAllChildren()` — та же ошибка для LAZY.

Все четыре точки используют один и тот же неверный источник ростера
(`fetchAllChildren()`/`getChildrenByGroup()`, полный список без учёта
даты/присутствия) вместо presentRoster.

## Где хранить `presentRoster` — решение

**Не заводить новую таблицу и не использовать `children_today`.**

`children_today.presence_today`/`presence_now` — подтверждено чтением
живого триггера `on_scan_insert_batch()` (`backup/database/schema.sql`,
идентично `doc/db/date_scoped_daily_tables.sql`) — представляют собой
"храповик": выставляются в `1` первым сканом дня и **не сбрасываются**
до конца дня (путь, который раньше это делал, `on_reset_event_insert`,
физически удалён тикетом 137). Это делает таблицу подмножеством "кто
хоть раз пришёл сегодня, когда угодно", а не зафиксированным на момент
Baseline снимком: опоздавший ребёнок, отмеченный только после обеда,
молча попал бы в presentRoster и "простил" бы себе статус "потерялся" —
противоречит смыслу "зафиксировать один раз и больше не пересчитывать".

Вместо этого presentRoster **вычисляется по требованию** из тех же
`scan_packets`/`scans`, что уже используются для `baseline_children_count`,
отфильтрованных по `checkpoint_id` дневной Baseline-точки — той же самой
выборки, которой сервер (`finish_checkpoint()`, `doc/db/checkpoints.sql`)
уже считает `COUNT(DISTINCT child_id)`. Новая функция, переиспользующая
уже импортированные `fetchScanPacketsForCheckpoint`/
`fetchScansForPacketIds`:

```js
// useCheckpoints.js
export async function getDayPresentRosterIds(day) {
    const baselineCp = await getDayBaselineCheckpoint(day) // уже существует
    if (!baselineCp) return null
    const packets = await fetchScanPacketsForCheckpoint(baselineCp.id)
    const scans = await fetchScansForPacketIds(packets.map(p => p.id))
    return new Set(scans.map(s => s.child_id))
}
```

Ноль изменений схемы, гарантированная согласованность с
`baseline_children_count` (тот же источник данных по построению).
Известное ограничение (не регрессия, тот же класс хрупкости, что и у
существующего `baseline_children_count`): если Baseline-точку
переоткрыть (`reopen_checkpoint`) и добавить новые пакеты, presentRoster
пересчитается на новые данные, а замороженный `baseline_children_count`
(не пересчитывается при повторном Finish) — нет. Не устраняется в
рамках этого тикета.

# Затрагиваемые модули

- `doc/db/checkpoints_baseline_confirm.sql` (новый файл) — изменение
  сигнатуры `finish_checkpoint()`, новая функция `set_checkpoint_baseline()`.
- `src/composables/useSupabaseCheckpoints.js` — `rpcFinishCheckpoint()`
  (новый параметр), новая `rpcSetCheckpointBaseline()`.
- `src/composables/useCheckpoints.js` — новая `getDayPresentRosterIds()`,
  правки `getBusChildrenBreakdown()`, `getGroupChildrenBreakdown()`,
  `buildGroupsForCheckpoint()`, `finishCheckpoint()`, новая
  `setCheckpointBaseline()`, `translateRpcError()`.
- `src/composables/useLazyCheckpointProgress.js` — `fetchLazyCheckpointProgress()`.
- `src/views/CheckpointBusView.vue`, `CheckpointGroupView.vue`,
  `CheckpointLazyView.vue` — `onFinish()`, новая кнопка "Als
  Tagesreferenz festhalten", условия отображения "Fehlend"-блоков.
- `vault/02-Предметная-область/Checkpoint.md` — разделы
  "Missing/Extra/Comparison" и "Baseline присутствия".
- `CLAUDE.md` — новый пункт о целевом экране (iPhone 12).

# Изменения БД

Новый файл `doc/db/checkpoints_baseline_confirm.sql` (применяется
вручную через Supabase SQL Editor, как и все предыдущие тикеты —
ассистент не имеет прямого доступа к боевой БД):

```sql
-- 1) finish_checkpoint(): необязательный p_set_baseline (default true) -
--    сохраняет обратную совместимость для уже задеплоенных вызовов.
CREATE OR REPLACE FUNCTION public.finish_checkpoint(
    p_id bigint,
    p_set_baseline boolean DEFAULT true
)
RETURNS public.checkpoints AS $$
DECLARE
  v_admin_id bigint;
  v_row public.checkpoints;
  v_is_first_of_day boolean;
  v_baseline smallint;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
  WHERE user_id = auth.uid() AND role = 'admin' AND active = true;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  UPDATE public.checkpoints
  SET status = 2, finished_at = now(), finished_by = v_admin_id
  WHERE id = p_id AND status = 1
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_OPEN';
  END IF;

  IF p_set_baseline THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.checkpoints
      WHERE day = v_row.day AND baseline_children_count IS NOT NULL
    ) INTO v_is_first_of_day;

    IF v_is_first_of_day THEN
      SELECT COUNT(DISTINCT s.child_id) INTO v_baseline
      FROM public.scans s
      JOIN public.scan_packets sp ON sp.id = s.packet_id
      WHERE sp.checkpoint_id = p_id;

      UPDATE public.checkpoints
      SET baseline_children_count = v_baseline
      WHERE id = p_id
      RETURNING * INTO v_row;
    END IF;
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2) Новая функция: явная отложенная фиксация Baseline на уже
--    закрытой точке (если админ отказался в момент Schließen, или
--    просто ни одна точка дня ещё не стала Baseline).
CREATE OR REPLACE FUNCTION public.set_checkpoint_baseline(p_id bigint)
RETURNS public.checkpoints AS $$
DECLARE
  v_admin_id bigint;
  v_row public.checkpoints;
  v_is_first_of_day boolean;
  v_baseline smallint;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
  WHERE user_id = auth.uid() AND role = 'admin' AND active = true;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT * INTO v_row FROM public.checkpoints WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_row.status <> 2 THEN
    RAISE EXCEPTION 'NOT_FINISHED';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.checkpoints
    WHERE day = v_row.day AND baseline_children_count IS NOT NULL
  ) INTO v_is_first_of_day;

  IF NOT v_is_first_of_day THEN
    RAISE EXCEPTION 'BASELINE_ALREADY_SET';
  END IF;

  SELECT COUNT(DISTINCT s.child_id) INTO v_baseline
  FROM public.scans s
  JOIN public.scan_packets sp ON sp.id = s.packet_id
  WHERE sp.checkpoint_id = p_id;

  UPDATE public.checkpoints
  SET baseline_children_count = v_baseline
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

RLS не меняется — обе функции `SECURITY DEFINER`, как и остальные RPC
`checkpoints` (см. `doc/db/checkpoints.sql`, "writes only through the
SECURITY DEFINER functions").

# API изменения

- `finish_checkpoint(p_id)` → `finish_checkpoint(p_id, p_set_baseline default true)`.
  Существующие вызовы без второго параметра продолжают работать как
  раньше (фиксируют Baseline автоматически, если это первая точка дня).
- Новый RPC `set_checkpoint_baseline(p_id)`. Новый код ошибки
  `BASELINE_ALREADY_SET` (день уже получил Baseline от другой точки,
  например гонка двух администраторов) — добавляется в общую ветку
  `translateRpcError()` (`useCheckpoints.js:253`) рядом с `NOT_OPEN`/
  `NOT_FINISHED`/`NOT_FOUND`/`NOT_ADMIN`.

```js
// useSupabaseCheckpoints.js
const rpcFinishCheckpoint = async (id, setBaseline = true) => {
    const { data, error } = await supabase.rpc('finish_checkpoint', {
        p_id: id,
        p_set_baseline: setBaseline
    })
    if (error) throw error
    return data
}

const rpcSetCheckpointBaseline = async (id) => {
    const { data, error } = await supabase.rpc('set_checkpoint_baseline', { p_id: id })
    if (error) throw error
    return data
}
```

```js
// useCheckpoints.js
export async function finishCheckpoint(id, setBaseline = true) {
    let row
    try {
        row = await rpcFinishCheckpoint(id, setBaseline)
    } catch (error) {
        return translateRpcError(error)
    }
    return fetchCheckpointDetail(row.id)
}

export async function setCheckpointBaseline(id) {
    let row
    try {
        row = await rpcSetCheckpointBaseline(id)
    } catch (error) {
        return translateRpcError(error)
    }
    return fetchCheckpointDetail(row.id)
}
```

# Изменения существующих компонентов

## `getBusChildrenBreakdown(cp)` / `getGroupChildrenBreakdown(cp)`

`absent` пересекается с `getDayPresentRosterIds(cp.day)`: только дети из
presentRoster, которых нет среди текущих присутствующих. Если
`getDayPresentRosterIds()` вернул `null` (у дня ещё нет Baseline) —
`absent: []`.

Для `getGroupChildrenBreakdown()` заодно убираются N отдельных запросов
`getChildrenByGroup()` в цикле — переходим на один `fetchAllChildren()` +
фильтр в JS (тот же паттерн, что уже использует `buildGroupsForCheckpoint()`);
"нулевые" группы (`!hasData`) добавляют в `absent` только пересечение
своего состава с presentRoster, а не весь состав группы целиком.

## `buildGroupsForCheckpoint()`

`morning` и `missingChildren` считаются относительно presentRoster дня,
если он есть; если Baseline ещё не зафиксирован — прежнее поведение
(весь состав группы) как единственный доступный ориентир на этот момент
(в этом состоянии UI всё равно скрывает "Fehlend", см. ниже).

## `fetchLazyCheckpointProgress(checkpointId)`

Требуется `day` точки для поиска Baseline — достаётся из уже читаемой
строки точки (`fetchCheckpointRowById`) в начале функции. `notYet`
пересекается с presentRoster тем же образом.

## Видимость "Fehlend" в UI (3 вью)

Скрывается целиком, когда `!resultSummary.hasBaseline` (готовый флаг,
уже вычисляется `summarizeCheckpoint()` и уже используется для строки
`.cp-result-row-final` в `CheckpointBusView.vue`) — расширяется на
карточку "Kinder & Betreuer gesamt" (все три типа) и на построчный
"fehlen"/"mehr" в `CheckpointGroupView.vue`. Закрывает требование
"даже в первой перекличке fehlend не нужен": пока Baseline не
зафиксирован, `hasBaseline === false`, блок не рендерится вообще.

## `onFinish()` — подтверждение Baseline (все три вью, идентичный паттерн)

```js
async function onFinish() {
  actionError.value = null
  let setBaseline = true
  if (resultSummary.value && !resultSummary.value.hasBaseline) {
    setBaseline = confirm(
      'Soll die aktuelle Liste der anwesenden Kinder als Tagesreferenz festgehalten werden?'
    )
  }
  const issues = await checkpointHasOpenIssues(checkpoint.value)
  if (issues.hasIssues && !confirm(`${issues.message} Trotzdem schließen?`)) {
    return
  }
  await finishCheckpoint(checkpoint.value.id, setBaseline)
  await load()
}
```

Отказ (`Abbrechen`) не блокирует закрытие точки — она закрывается как
обычно, просто без Baseline.

## Новая кнопка "Als Tagesreferenz festhalten"

В блоке статуса каждого из трёх вью,
`v-if="checkpoint.status === FINISHED && resultSummary && !resultSummary.hasBaseline"`.
Действие — прямой вызов `setCheckpointBaseline(checkpoint.id)` → `load()`,
без дополнительного `confirm()` (действие не разрушительное, название
кнопки однозначно описывает эффект). Доступна на **любой** уже закрытой
точке дня, а не только на хронологически первой — так администратор
может отложить фиксацию, если первая перекличка была неполной/ошибочной,
и зафиксировать её позже по второй/третьей точке.

# Новые компоненты

Не требуются — только новые экспортируемые функции в существующих
composables (`getDayPresentRosterIds`, `setCheckpointBaseline`) и новая
DB-функция.

# UI изменения

- Новая кнопка "Als Tagesreferenz festhalten" в статус-блоке
  `CheckpointBusView.vue`/`CheckpointGroupView.vue`/`CheckpointLazyView.vue`.
- Условное скрытие всех "Fehlend"/"fehlen" элементов при отсутствии
  Baseline дня (см. выше) — визуально устраняет и путаницу, описанную в
  аудите тикета 146 (два по-разному считающихся "fehlend" на одном
  экране): при отсутствии Baseline один из них не показывается вообще,
  при наличии — оба считаются от одного и того же presentRoster.
- Новый confirm() на закрытии первой точки дня (текст выше).

# Документация

- `vault/02-Предметная-область/Checkpoint.md`: раздел
  "Missing/Extra/Comparison" — убрать формулировку "относительно всего
  Roster (буквально)" для `getBusChildrenBreakdown()`/
  `getGroupChildrenBreakdown()`, заменить на "относительно presentRoster
  дня". Раздел "Baseline присутствия" — дополнить описанием
  подтверждающего диалога и кнопки "Als Tagesreferenz festhalten",
  явно отметить, что `children_today` не подходит для хранения
  presentRoster и почему (см. "Анализ" выше).
- `CLAUDE.md`: новый пункт — приложение используется исключительно на
  телефонах (в основном iPhone), целевой экран для дизайна — iPhone 12
  (390×844 CSS px), а не desktop-раскладки.

# План реализации

1. Применить SQL из `doc/db/checkpoints_baseline_confirm.sql` к боевой
   БД через Supabase SQL Editor (вручную, вне сессии ассистента).
2. `useSupabaseCheckpoints.js`: обновить `rpcFinishCheckpoint()`,
   добавить `rpcSetCheckpointBaseline()`.
3. `useCheckpoints.js`: добавить `getDayPresentRosterIds()`; обновить
   `getBusChildrenBreakdown()`, `getGroupChildrenBreakdown()`,
   `buildGroupsForCheckpoint()`, `finishCheckpoint()`; добавить
   `setCheckpointBaseline()`; дополнить `translateRpcError()`.
4. `useLazyCheckpointProgress.js`: обновить `fetchLazyCheckpointProgress()`
   (добавить чтение `day` через `fetchCheckpointRowById`, пересечение
   `notYet` с presentRoster).
5. Обновить `onFinish()` и добавить кнопку "Als Tagesreferenz festhalten"
   в `CheckpointBusView.vue`, `CheckpointGroupView.vue`,
   `CheckpointLazyView.vue`; расширить условие видимости "Fehlend"-блоков.
6. `npm run build`.
7. Обновить `vault/02-Предметная-область/Checkpoint.md` и `CLAUDE.md`.
8. Ручная проверка на устройстве (см. Definition of Done) — отдельно от
   этой сессии.

# Риски

1. **Гонка двух администраторов** закрывающих разные точки одновременно
   в момент, когда Baseline ещё не установлен — обрабатывается кодом
   `BASELINE_ALREADY_SET` (не критично, просто одна из двух попыток
   зафиксировать Baseline проигрывает; сама точка при этом уже закрыта
   успешно на шаге 1 `finish_checkpoint()`).
2. **Реопен Baseline-точки с новыми пакетами** — presentRoster
   (вычисляется по требованию) и `baseline_children_count` (заморожен)
   могут разойтись после такого редкого сценария. Существующая
   хрупкость, не регрессия, не устраняется в этом тикете (см. "Анализ").
3. **`morning`/`missingChildren` до появления Baseline** — намеренно
   оставлены на полном составе группы как запасной вариант (UI всё
   равно скрывает "Fehlend" в этом состоянии) — если позже понадобится
   показывать что-то в этом состоянии, потребуется отдельное решение.

# Definition of Done

- SQL применён к боевой БД, `finish_checkpoint()` принимает
  `p_set_baseline`, `set_checkpoint_baseline()` работает.
- Все четыре функции ростера (`getBusChildrenBreakdown`,
  `getGroupChildrenBreakdown`, `buildGroupsForCheckpoint`,
  `fetchLazyCheckpointProgress`) сравнивают с presentRoster, а не с
  полным Roster.
- Подтверждающий диалог на немецком показывается при закрытии точки,
  которая стала бы первой Baseline дня; отказ не блокирует закрытие.
- Кнопка "Als Tagesreferenz festhalten" доступна на любой закрытой точке
  дня без Baseline.
- "Fehlend"-блоки скрыты, когда у дня нет Baseline, во всех трёх вью.
- `npm run build` проходит.
- `vault/02-Предметная-область/Checkpoint.md` и `CLAUDE.md` обновлены.
- Ручная проверка на устройстве — отмечена как выполненная либо явно
  отложена (обычная практика для этой серии тикетов).
- `tickets/dashboard.md` обновлён.
