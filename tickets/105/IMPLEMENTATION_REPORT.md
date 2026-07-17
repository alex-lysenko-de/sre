# IMPLEMENTATION_REPORT — Ticket 105

Migration of authentication storage from Local Storage to LocalForage.

## Измененные файлы

- `package.json` — добавлена зависимость `localforage`.
- `package-lock.json` — обновлён после `npm install localforage`.
- `src/supabase.js` — `createClient()` теперь получает `{ auth: { storage: supabaseStorageAdapter } }`.
- `src/App.vue` — `initializeApp()` читает `sre_user_registered` через `getAuthItem`; удалены `attemptAutoLogin()`, `getSavedCredentials()`, `clearSavedCredentials()`; `logout()` больше не чистит `auth_credentials` и делает `await userStore.clearUserCache()`.
- `src/router/index.js` — navigation guard читает `sre_user_registered` через `await getAuthItem(...)`.
- `src/views/LoginView.vue` — убраны чекбокс "Angemeldet bleiben", `rememberMe`, `getSavedCredentials()`, `saveCredentials()`, `clearCredentials()`, `autoLogin()`; `onMounted` оставляет только проверку активной сессии Supabase; `handleLogin()` пишет флаг регистрации через `await setAuthItem(...)`.
- `src/views/WelcomeView.vue` — запись `sre_user_registered` переведена на `await setAuthItem(...)`.
- `src/composables/useUser.js` — `loadFromCache`, `saveToCache`, `clearCache` переписаны на `getAuthItem`/`setAuthItem`/`removeAuthItem` из нового модуля, все три стали `async`.
- `src/stores/user.js` — `loadFromCache`, `saveToCache`, `clearUserCache` стали `async`; добавлен `await` во всех местах их вызова внутри `loadUser`, `assignUserToGroup`, `assignUserToBus`, `updateUserPresence`.

## Созданные файлы

- `src/modules/storage.js` — новый модуль:
  - `authLocalForage` — `localforage.createInstance({ name: 'sre-app', storeName: 'auth' })`.
  - `supabaseStorageAdapter` — key-agnostic passthrough-адаптер `{ getItem, setItem, removeItem }` для `createClient()`.
  - `getAuthItem(key)`, `setAuthItem(key, value)`, `removeAuthItem(key)` — общие async-хелперы.
  - Read-through lazy-миграция встроена в `getItem`/`getAuthItem`: сначала чтение из LocalForage, при отсутствии — чтение legacy-значения из `window.localStorage`, копирование в LocalForage и удаление из `localStorage`.

## Выполненные изменения

1. Добавлена зависимость `localforage`.
2. Создан `src/modules/storage.js` с `authLocalForage`, `supabaseStorageAdapter`, `getAuthItem`/`setAuthItem`/`removeAuthItem` и read-through-миграцией.
3. `src/supabase.js` передаёт `supabaseStorageAdapter` в `createClient()` — SDK Supabase теперь читает/пишет `sb-*-auth-token` через LocalForage.
4. `useUser.js`: кеш профиля (`user_info_cache`) переведён на LocalForage, функции стали `async`.
5. `stores/user.js`: добавлены `await` во всех вызовах методов кеша, `clearUserCache` стал `async`.
6. `router/index.js` и `App.vue`: чтение `sre_user_registered` переведено на `await getAuthItem(...)`.
7. Пароль-fallback (`auth_credentials`, чекбокс "Angemeldet bleiben", `attemptAutoLogin`/`getSavedCredentials`/`clearSavedCredentials` в `App.vue`, `getSavedCredentials`/`saveCredentials`/`clearCredentials`/`autoLogin`/`rememberMe` в `LoginView.vue`) полностью удалён.
8. Запись флага регистрации в `LoginView.vue` (`handleLogin`) и `WelcomeView.vue` (`handleRegister`) переведена на `setAuthItem`.
9. `app_config_cache` (`src/stores/config.js`) и настройка камеры сканера (`ScannerView.vue`) не тронуты — вне scope тикета.

## Отклонения от плана

Без отклонений. Реализация строго следует `IMPLEMENTATION_PLAN.md`, включая архитектурное решение об удалении пароль-fallback (раздел "Архитектурное решение по `auth_credentials`").

Одно уточнение логики, не меняющее план по существу: в `App.vue` `initializeApp()` в плане описано как замена `attemptAutoLogin()` на редирект к `/login`, если сессии нет (т.к. пароль-fallback удалён и авто-логина по паролю больше не существует) — реализовано именно так: при отсутствии сессии сразу `router.push('/login')` (с той же проверкой текущего пути, что была в `attemptAutoLogin()`), без дополнительной функции-обёртки.

## Требуемые миграции

БД/Edge Functions не затронуты, миграций backend нет.

Клиентская read-through-миграция данных `localStorage → LocalForage` встроена в код (`src/modules/storage.js`) и срабатывает автоматически при первом обращении к каждому ключу после деплоя — отдельного скрипта миграции не требуется.

## Ручные проверки

Не выполнялись в рамках данной реализации (нет доступа к браузеру/iOS-устройству в среде разработки). Требуется ручное QA согласно пп. 9–12 `IMPLEMENTATION_PLAN.md`:

- [ ] Чистый `localStorage` + новая регистрация по инвайту → сессия появляется в LocalForage (DevTools → Application → IndexedDB), не в `localStorage`.
- [ ] Обратная совместимость: существующий `sre_user_registered`/`sb-*-auth-token` в `localStorage` корректно переносится в LocalForage при первом запуске новой версии, без принудительного релогина.
- [ ] iOS Safari: обычная вкладка — логин, закрыть/открыть Safari, сессия сохраняется.
- [ ] iOS Safari standalone ("Добавлено на экран Домой"): логин, принудительное закрытие, повторное открытие — сессия сохраняется.
- [ ] Регрессия на Android (обычный Chrome + установленное PWA) — поведение не изменилось.

Автоматически выполнено: `npm install localforage` и `npm run build` — сборка проходит без ошибок.
