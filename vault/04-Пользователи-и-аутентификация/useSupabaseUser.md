# `useSupabaseUser.js` (composable)

> Источник: `src/composables/useSupabaseUser.js`.

Чисто «database layer» — единственный слой в этом стеке, который
непосредственно импортирует `supabase` из `@/supabase`. Не содержит
кэширования и оркестрации (это задача [[useUser]]).

## Методы

| Метод | Назначение |
|---|---|
| `getSession()` | Текущая сессия Supabase Auth, бросает при отсутствии |
| `getAuthUser()` | `supabase.auth.getUser()` |
| `getCurrentUser()` | Auth-пользователь → строка [[users]] по `user_id`; используется там, где нужен именно числовой `id` из `users` (например [[useBusData]], [[useDays]] для `reset_events.user_id`, `scans.user_id`) |
| `fetchUserFromDB(authUserId)` | Строка [[users]] по `user_id` (uuid) |
| `fetchScheduleForDate(userId, date)` | Строка [[user_group_day]] за конкретный день |
| `fetchLastKnownSchedule(userId)` | Последняя по дате запись [[user_group_day]] — fallback для предзаполнения формы |
| `checkScheduleExists(userId, date)` / `updateScheduleRecord()` / `insertScheduleRecord()` | Примитивы upsert для [[user_group_day]], используются [[useUser]].`upsertScheduleField()` |
| `subscribeToUsersTable()` / `removeChannel()` | Обёртка над Supabase Realtime для [[users]] |
| `signOut()` | `supabase.auth.signOut()` |

## Почему отдельный слой, а не часть `useUser.js`

Разделение «только Supabase-запросы» / «кэш и бизнес-логика» — тот же
принцип, что применяется во всех `src/composables/useXXX.js` (см.
[[Обзор-composables]]), позволяет тестировать/заменять слой данных, не
трогая логику кэширования. `getCurrentUser()` здесь переиспользуется и
за пределами модели пользователя — например, [[useBusData]] и [[useDays]]
ре-экспортируют его как `getCurrentUser` для получения `users.id` перед
записью в [[reset_events]].

## Связанные заметки

- [[useUser]]
- [[stores-user]]
- [[users]]
- [[user_group_day]]
- [[Модель-аутентификации]]
