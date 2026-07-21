# Кэширование через LocalForage

> Источники: `doc/migration_guide.md` (тикет 105), `src/modules/storage.js`.

## Что это

`src/modules/storage.js` инкапсулирует единственный экземпляр LocalForage
(`authLocalForage`, IndexedDB с автоматическим fallback) для всех auth-
связанных данных приложения — вместо прежнего `localStorage`.

```js
export const authLocalForage = localforage.createInstance({
    name: 'sre-app',
    storeName: 'auth'
})
```

## Read-through-миграция

Каждое чтение (`getAuthItem`/`readThrough`) сначала проверяет LocalForage;
если значения там нет — читает `window.localStorage`, и если найдено —
переносит его в LocalForage и удаляет из `localStorage`. Это позволяет
пользователям, у которых данные ещё лежат в старом `localStorage` (до
миграции тикета 105), продолжить работу без повторного логина — миграция
происходит прозрачно при первом обращении к ключу.

## Что здесь хранится

- `user_info_cache` — кэш `userInfo`, TTL 60 секунд (см. [[useUser]])
- `sre_user_registered` — флаг «пользователь хотя бы раз проходил
  регистрацию», используется в `router.beforeEach` для гостевого доступа
  (см. [[Модель-аутентификации]])
- Сессия Supabase Auth — через `supabaseStorageAdapter`, передаваемый в
  `createClient({ auth: { storage } })`; ключ-агностичный passthrough к тем
  же `getAuthItem`/`setAuthItem`/`removeAuthItem`

## Почему LocalForage, а не `localStorage`

`doc/migration_guide.md` фиксирует переход как отдельный тикет (105) —
`localStorage` синхронный и ограничен по объёму/типам (только строки),
IndexedDB (через LocalForage) снимает оба ограничения и не блокирует
основной поток при больших объёмах кэша. Обратная совместимость
обеспечена read-through-миграцией, а не одномоментной миграцией данных.

## Отдельный кэш конфигурации

`stores/config.js` (`useConfigStore`) использует собственный ключ
`app_config_cache` напрямую через `localStorage` (TTL 5 минут) — **не**
через `storage.js`/LocalForage. Это два независимых механизма кэширования
в проекте; общей миграции конфигурации на LocalForage на момент ревизии
(тикет 108) не выполнено.

## Связанные заметки

- [[useUser]]
- [[Модель-аутентификации]]
- [[config]]
- [[Работа-без-интернета]]
