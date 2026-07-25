# Измененные файлы

| Файл | Изменение |
|---|---|
| `src/views/WelcomeView.vue` | Добавлен опциональный выбор группы в форму регистрации; загрузка конфига (`useConfigStore.loadConfig()`) в `onMounted()`; после успешного автологина, при заданной `selectedGroup`, вызов `userStore.loadUser(true)` + `userStore.assignUserToGroup(selectedGroup.value)` в некритичном `try/catch`. |
| `src/views/GroupEditView.vue` | Добавлен флаг `noGroupAssigned`; в `created()` — блокировка (без вызова `loadInitialData()`), если ни `route.params.id`, ни `userInfo.group_id` не заданы; в шаблоне — новый блок `v-else-if="noGroupAssigned"` с блокирующим сообщением по образцу `HeadcountView.vue`. |
| `src/App.vue` | Строка с индикаторами "Gruppe"/"Bus" разделена на два независимых условия: индикатор группы теперь виден при `userStore.userInfo.id` (не зависит от `isPresentToday`); индикатор автобуса остаётся под прежним условием `!isCheckInRequired && userStore.userInfo.isPresentToday`. |

# Новые файлы

Нет.

# Реализованные изменения

Строго по `IMPLEMENTATION_PLAN.md`, архитектурное решение (б) (запись
выбранной группы через уже существующий `assignUserToGroup()` /
`upsertScheduleField()` в `user_group_day` на сегодняшнюю дату, без новых
столбцов/таблиц):

1. **`WelcomeView.vue`** — в форму регистрации добавлено необязательное
   поле "Gruppe (optional)" (`<select v-model.number="selectedGroup">`,
   опции `1..configStore.totalGroups` + "Keine Angabe" со значением
   `null`). `useConfigStore` и `useUserStore` подключены; конфиг грузится
   в `onMounted()` рядом с разбором `invite`-токена (таблица `config`
   публично читаема, вызов безопасен до входа). После успешного
   `signInWithPassword()` и записи `sre_user_registered`, но **до**
   `router.push('/main')`: если `selectedGroup.value` задан — форсированная
   `userStore.loadUser(true)` (получить `id` только что созданного
   пользователя без риска устаревшего кэша), затем
   `userStore.assignUserToGroup(selectedGroup.value)`. Обёрнуто в отдельный
   `try/catch`, который только логирует ошибку — предзаполнение группы не
   прерывает переход на `/main` и не блокирует регистрацию.

2. **`GroupEditView.vue`** — в `created()`, после определения `groupId` из
   `route.params.id` либо (если параметра нет) из
   `userStore.userInfo.group_id`: если оба источника пусты — `groupId`
   остаётся falsy, устанавливается `noGroupAssigned = true`,
   `loadInitialData()` не вызывается. Явный `route.params.id`
   (администратор, переход из `/children`) всегда пропускает блокировку —
   это и есть исключение "кроме администратора" из тикета, так как у
   администратора нет другого пути в `/group-edit`, кроме явного `:id`.
   В шаблоне существующий блок со списком детей и кнопками обёрнут в новый
   `v-else-if="!noGroupAssigned"` (структура `v-if/v-else-if/.../v-else`
   сохранена), добавлен блок `v-else-if="noGroupAssigned"` с текстом
   "Ihnen ist heute keine Gruppe zugewiesen. Gruppenverwaltung ist nicht
   möglich." — по образцу уже существующего паттерна в
   `HeadcountView.vue`. `canShowHeadcountButton`/`goToHeadcount()` не
   менялись — они просто становятся недостижимы, пока действует блокировка.

3. **`App.vue`** — строка 27 (`v-if="!isCheckInRequired &&
   userStore.userInfo.isPresentToday"`, общая для обеих кнопок) разделена
   на два независимых условия внутри той же обёртки `<div>`:
   - Кнопка "Gruppe ändern": `v-if="userStore.userInfo.id"` — видна сразу
     после загрузки пользователя, без ожидания подтверждения "Ich fahre
     heute mit!". Закрывает пункт 3 тикета (относится только к группе).
   - Кнопка "Bus ändern": условие оставлено без изменений —
     `!isCheckInRequired && userStore.userInfo.isPresentToday` — по
     плану, `bus_id` без подтверждённого check-in напрямую попадает в
     сканы (`ScannerView.vue`), поэтому развязывать индикатор автобуса от
     `isPresentToday` не требовалось и не делалось.

   `GroupChangeModal.vue`/`stores/user.js`/`assignUserToGroup()` — не
   менялись, они уже не зависели от `isPresentToday`/`bMustWorkToday` (это
   было подтверждено в плане чтением кода, а не новым изменением).

Не затронуты (согласно плану, изменений не требовалось):
`MainView.vue`, `HeadcountView.vue`, `GroupChangeModal.vue`,
`BusChangeModal.vue`, `DailyCheckInModalView.vue`, `useGroups.js`,
`useBusData.js`, `useUser.js`, `useSupabaseUser.js`, `stores/user.js`,
`router/index.js`, схема БД, Edge Functions.

# Отклонения от плана

Нет. Реализация выполнена строго по `IMPLEMENTATION_PLAN.md`, включая
явное решение не трогать индикатор/логику автобуса и не разрабатывать
новое постоянное поле для "домашней группы" (вариант (а) отклонён в
пользу (б), как зафиксировано в плане).

# Миграции

Нет. Используется существующая таблица `user_group_day` через уже
существующий метод записи (`upsertScheduleField`/`assignUserToGroup`),
без новых столбцов, таблиц, индексов или миграций. Edge Function
`invite-accept` не менялась.

# Проверки

- `git status --short src/` / `git diff --stat src/` — подтверждено, что
  изменены ровно три файла, предусмотренные планом: `App.vue`,
  `WelcomeView.vue`, `GroupEditView.vue`.
- `npm run build` — сборка проходит успешно (318 модулей, без ошибок;
  предупреждения о размере чанков и версии Node — существовавшие ранее,
  не связаны с этой правкой).
- Ручная проверка в браузере (`npm run dev` с реальными
  Supabase-сценариями инвайт-регистрации, входа, `/group-edit` с/без
  `group_id`, открытия "Gruppe ändern" до check-in, проверки
  `/children`/`/admin-busses` на отсутствие искажения счётчиков
  присутствия) не выполнялась в рамках этой сессии — окружение Supabase
  недоступно для интерактивной проверки из текущей среды. Изменения
  ограничены точечными правками условий видимости UI и одним
  дополнительным (некритичным, обёрнутым в `try/catch`) вызовом уже
  существующего метода записи группы, что по своей природе несёт низкий
  риск регрессии (см. также раздел «Риски» в `IMPLEMENTATION_PLAN.md`).
  Рекомендуется выполнить 5 ручных сценариев из плана (раздел «План
  реализации», п. 5) перед мержем — включая отдельную проверку того, что
  кнопка "Bus ändern" по-прежнему НЕ показывается до подтверждения "Ich
  fahre heute mit!" (риск случайного объединения условий при разделении
  строки в `App.vue`).

# Исправления после ревью

Исправлено единственное обязательное замечание из `REVIEW_REPORT.md`
(раздел «Список обязательных исправлений», Major 1):

- **`GroupEditView.vue` — `noGroupAssigned` не сбрасывался реактивно.**
  Watcher `'userStore.userInfo.group_id'` подгружал данные новой группы
  через `loadInitialData()`, но не сбрасывал `noGroupAssigned` в `false`.
  Из-за порядка `v-if/v-else-if` в шаблоне блокирующий экран "Ihnen ist
  heute keine Gruppe zugewiesen…" продолжал перекрывать список детей даже
  после того, как пользователь назначал себе группу через "Gruppe ändern"
  из шапки, находясь на уже смонтированном заблокированном `/group-edit`
  — требовалась перезагрузка страницы. Добавлена строка
  `this.noGroupAssigned = false` в тело watcher рядом с обновлением
  `groupNumber`, до вызова `loadInitialData()`.

Второй пункт списка обязательных исправлений («Выполнить ручную проверку
сценариев из плана») — не задача на изменение кода; статус вручную
проведённого тестирования зафиксирован ниже в разделе «Проверки» этого
дополнения. Список необязательных улучшений (вынести разметку выбора
группы в общий компонент; не грузить `configStore.loadConfig()` при
отсутствующем `inviteToken`) не затрагивался — по условию задачи
исправляются только обязательные замечания ревью, минимизация изменений.

# Измененные файлы

| Файл | Изменение |
|---|---|
| `src/views/GroupEditView.vue` | В watcher `'userStore.userInfo.group_id'` добавлена строка `this.noGroupAssigned = false`, выполняемая вместе с обновлением `groupNumber` и до `loadInitialData()`, когда `newGroupId` истинно и `route.params.id` отсутствует. |

# Проверки

- `git status --short src/` — подтверждено, что в рамках этого раунда
  правок изменён ровно один файл: `src/views/GroupEditView.vue`.
- `npm run build` — сборка проходит успешно (322 модуля, без ошибок;
  предупреждения о размере чанков и версии Node — существовавшие ранее,
  не связаны с этой правкой).
- Ручная проверка сценария из Major 1 (открыть "Gruppe ändern" из шапки,
  находясь на заблокированном `/group-edit`, и убедиться, что список
  детей появляется без перезагрузки страницы) не выполнялась в рамках
  этой сессии — окружение Supabase недоступно для интерактивной проверки
  из текущей среды. Изменение — однострочное присвоение внутри уже
  существующего watcher, синхронное с уже проверяемым (тем же watcher'ом)
  обновлением `groupNumber`, поэтому риск регрессии низкий, но ручная
  проверка перед мержем по-прежнему рекомендуется (см. также
  `REVIEW_REPORT.md`, «Список обязательных исправлений», второй пункт —
  полный набор из 5 сценариев `IMPLEMENTATION_PLAN.md`, раздел «План
  реализации», п. 5, целиком не проводился).
