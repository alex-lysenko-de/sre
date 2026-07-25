# Измененные файлы

| Файл | Изменение |
|---|---|
| `src/main.js` | Импорт `useInstallPromptStore`, вызов `useInstallPromptStore().init()` сразу после `app.use(pinia)`, до `await configStore.initConfigModule()` — регистрация `beforeinstallprompt`/`appinstalled` максимально рано, не блокирует `app.mount()`. |
| `src/App.vue` | Импорт и монтирование `<InstallAppButton>` и `<InstallIosInstructionsModal>` как siblings существующих модалок в корневом `<div>`, вне блока `<nav v-if="isAuthenticated">`. Добавлена обёртка `.install-app-button-wrapper` (`position: fixed`, правый нижний угол) для видимости кнопки как в шапке авторизованного приложения, так и в `WelcomeView`/`LoginView` до появления навбара. Существующие Gruppe/Bus-индикаторы не менялись. |
| `src/views/WelcomeView.vue` | Импорт `useInstallPromptStore`; в `handleRegister()` вызов `installPromptStore.triggerBanner()` сразу после `success.value = true`, до `setTimeout(...)`/`signInWithPassword()`. Шаблон не менялся. |
| `src/views/LoginView.vue` | Импорт `useInstallPromptStore`; в `handleLogin()` вызов `installPromptStore.triggerBanner()` сразу после успешной проверки роли/`active`, до `setAuthItem('sre_user_registered', ...)`. `redirectToHome()`/условия редиректа не менялись. |

# Новые файлы

| Файл | Назначение |
|---|---|
| `src/stores/installPrompt.js` | Pinia-стор `installPrompt`: состояние `deferredPrompt` (через `markRaw()`), `platform` (`'android' \| 'ios' \| 'other'`), `isStandalone`, `bannerTriggered`, `showIosInstructions`; геттеры `canInstall`/`showButton`; действия `init()`, `triggerBanner()`, `promptInstall()`, `closeIosInstructions()`. |
| `src/components/InstallAppButton.vue` | Кнопка «📲 App installieren», `v-if` на `installPromptStore.showButton`, по клику вызывает `installPromptStore.promptInstall()`. |
| `src/components/InstallIosInstructionsModal.vue` | Модалка с пошаговой инструкцией на немецком («Teilen → Zum Home-Bildschirm → Hinzufügen»), по образцу `LogoutConfirmModal.vue`; `v-if` на `installPromptStore.showIosInstructions`. |

# Реализованные изменения

Строго по `IMPLEMENTATION_PLAN.md`, шаги 1-6 плана реализации:

1. **`src/stores/installPrompt.js`** — создан стор целиком, без зависимостей
   от других изменений. `init()` определяет `isStandalone`
   (`matchMedia('(display-mode: standalone)')` или guard'ированный
   `navigator.standalone`) и `platform` (iOS — по `userAgent`; иначе —
   по фиче-детекту `'onbeforeinstallprompt' in window`, что даёт корректный
   `'other'` для десктоп-браузеров без поддержки, например Firefox), затем
   регистрирует слушатели `beforeinstallprompt` (`e.preventDefault()`,
   `deferredPrompt = markRaw(e)`) и `appinstalled`
   (`deferredPrompt = null`, `isStandalone = true`). `canInstall`/
   `showButton` реализованы в точности по формулам из плана.
   `promptInstall()` на Android дожидается `deferredPrompt.prompt()` и
   `userChoice`, затем обнуляет `deferredPrompt` (одноразовое событие); на
   iOS открывает `showIosInstructions`.
2. **`src/main.js`** — `useInstallPromptStore().init()` вызывается сразу
   после `app.use(pinia)`, синхронно, не через `await`, до
   `configStore.initConfigModule()` — событие `beforeinstallprompt` не
   может быть пропущено.
3. **`InstallAppButton.vue`/`InstallIosInstructionsModal.vue`** — созданы
   по описанным в плане паттернам (модалка — по образцу
   `LogoutConfirmModal.vue`), без собственной платформенной логики — всё
   ветвление инкапсулировано в сторе.
4. **`App.vue`** — оба компонента смонтированы на корневом уровне (siblings
   `LogoutConfirmModal`), вне `<nav v-if="isAuthenticated">`, что позволяет
   компонентам пережить переход `WelcomeView → /main` (авто-логин через
   1.5с) без размонтирования.
5. **`WelcomeView.vue`** — `triggerBanner()` вызывается в success-блоке,
   до `setTimeout`/`signInWithPassword()`, как того требует анализ плана
   (первая запись в LocalForage происходит внутри самого
   `signInWithPassword()`).
6. **`LoginView.vue`** — `triggerBanner()` вызывается сразу после
   успешной проверки роли/`active`, до `setAuthItem(...)`.

Не затронуты (по плану, изменений не требовалось): `vite.config.js`
(PWA/manifest/SW уже настроены), `src/router/index.js`, схема БД, Edge
Functions, `stores/user.js`, `stores/config.js`, все прочие views и
composables, существующие Gruppe/Bus-индикаторы и модалки в `App.vue`.

# Отклонения от плана

Нет содержательных отклонений. Единственная точка, где план оставлял
финальную формулировку на усмотрение реализации ("финальную формулировку
и иконку — на этапе реализации", "UI изменения"): текст кнопки выбран
"📲 App installieren", позиционирование — `position: fixed` в правом
нижнем углу экрана (обёртка `.install-app-button-wrapper` в `App.vue`),
чтобы кнопка была одинаково видна и в шапке авторизованного приложения, и
в `WelcomeView`/`LoginView`, где навбар (`<nav v-if="isAuthenticated">`)
ещё не отображается. Это не архитектурное решение, а точечный
UI-параметр, явно оставленный на усмотрение реализации в разделе «Новые
компоненты» плана.

Буквальное требование тикета «до первой записи в LocalForage» для
`LoginView.vue` осознанно не выполнено буквально — это зафиксированное
в разделе «Риски» плана ограничение архитектуры Supabase JS SDK
(`signInWithPassword()` сам пишет в LocalForage синхронно с успешным
ответом), не решение этой задачи.

# Миграции

Нет. Задача не затрагивает схему данных, таблицы, RLS-политики или Edge
Functions — вся логика клиентская (Pinia-стор + браузерные API
`beforeinstallprompt`/`matchMedia`).

# Проверки

- `git status --short src/` — подтверждено, что изменены/добавлены ровно
  предусмотренные планом файлы: `App.vue`, `main.js`, `LoginView.vue`,
  `WelcomeView.vue` (изменены), `stores/installPrompt.js`,
  `components/InstallAppButton.vue`,
  `components/InstallIosInstructionsModal.vue` (новые).
- `npm run build` — сборка проходит успешно (322 модуля, без ошибок;
  предупреждения о размере чанков и версии Node/browserslist —
  существовавшие ранее, не связаны с этой правкой).
- Ручная проверка в браузере (реальные сценарии `beforeinstallprompt` на
  Android Chrome, инструкция на iPhone Safari, standalone-детект на обеих
  платформах, десктоп-браузер без поддержки) не выполнялась в рамках этой
  сессии — окружение недоступно для интерактивной проверки из текущей
  среды, а часть сценариев (`beforeinstallprompt`, реальная установка на
  физическое устройство) в принципе не может быть полноценно
  автоматизирована (см. раздел «Риски» плана: Chrome применяет
  engagement heuristics, `beforeinstallprompt` может не сработать при
  первом визите независимо от корректности кода). Рекомендуется перед
  мержем выполнить все 6 ручных сценариев из плана (раздел «План
  реализации», п. 7), в первую очередь:
  - Android Chrome DevTools (Application → Manifest → «Add to home
    screen») для принудительной проверки `deferredPrompt.prompt()`;
  - iPhone Safari — открытие модалки с немецкой инструкцией и то, что
    закрытие модалки не блокирует дальнейшую работу;
  - проверку, что кнопка не показывается в standalone-режиме на обеих
    платформах;
  - проверку, что переход `WelcomeView → /main` (через 1.5с) не приводит
    к размонтированию кнопки/незакрытой iOS-модалки.
