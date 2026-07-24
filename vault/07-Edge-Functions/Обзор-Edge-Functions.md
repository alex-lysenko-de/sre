# Обзор Edge Functions

> Источники: `supabase/functions/{auth,delete-user,invite-accept,invite-generate}/index.ts`
> — все четыре прочитаны построчно по итогам ревью тикета 108
> (`tickets/108/REVIEW_REPORT.md`, Critical 2; в исходной версии этой
> заметки исходники не открывались, назначение функций описывалось только
> по имени каталога — это и было одной из причин, почему слой
> `sessions`/`invites`/WebAuthn остался незамеченным). `doc/genkeys_curl.bat`
> (пример вызова `invite-generate`, оставлен как есть в тикете 107 —
> соответствует коду, секретов не содержит).

Edge Functions выполняются на стороне Supabase (Deno) — используются для
операций, которые не должны или не могут выполняться напрямую с клиента
через обычный Supabase JS SDK (административные действия с `auth.users`,
секреты вроде `service_role`-ключа).

## Функции

| Функция | Назначение | Связанный UI |
|---|---|---|
| `auth` | WebAuthn/passkey-регистрация и вход + собственный HMAC JWT (`generateJWT()`); ни разу не вызывается из `src/` и рассинхронизирована с реальной схемой — см. [[Инвайты-сессии-WebAuthn]] | — (не подключена к UI) |
| `delete-user` | Проверяет по `Authorization`-токену, что вызывающий — активный admin (через `service_role`-клиент), запрещает удалить самого себя, затем `auth.admin.deleteUser()`; `public.users` удаляется каскадом (`ON DELETE CASCADE`) | `UsersView.vue` (`/users-edit`, admin-only) |
| `invite-generate` | Проверяет админскую роль вызывающего, создаёт строку `invites` (`invite_token`, `role`, `expires_at`) | `InviteGeneratorView.vue` (`/invite`, admin-only) |
| `invite-accept` | Публичная — проверяет `invite_token`/`used`/`expires_at`, создаёт `auth.users` через `auth.admin.createUser({email, password})` и строку `public.users`, помечает приглашение использованным — см. [[Инвайты-сессии-WebAuthn]] | `InviteAcceptView.vue`, `WelcomeView.vue` |

`doc/genkeys_curl.bat` — рабочий пример прямого вызова `invite-generate`
через `curl`, подтверждённый в тикете 107 как соответствующий коду функции.

## Секреты

Развёртывание и секреты Edge Functions (в частности реальный
`service_role`-ключ) описаны в `doc/sb_install_keys.bat` /
`doc/supabase_install.md` — оба файла содержат реальный ключ в открытом
виде (зафиксировано как проблема безопасности в
`tickets/107/AUDIT_REPORT.md`, не устранено по прямому указанию владельца
проекта на момент той ревизии). Эта заметка **не цитирует** значение ключа
— только упоминает факт и его расположение, см. `_Конвенции.md`, пункт 6.

## Связанные заметки

- [[Модель-аутентификации]]
- [[Инвайты-сессии-WebAuthn]]
- [[users]]
- [[Карта-маршрутов]]
- [[Обзор-архитектуры]]
