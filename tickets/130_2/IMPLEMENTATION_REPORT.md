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
