# `stores/user.js` (Pinia store)

> Источник: `src/stores/user.js`.

Pinia store `useUserStore` — единственный держатель реактивного состояния
пользователя в приложении. Согласно принятому в проекте разделению (см.
`doc/migration_guide.md`, «Migration Checklist»): **store хранит только
состояние и геттеры, вся бизнес-логика делегируется [[useUser]]**.

## Состояние

```js
userInfo: {
  id, user_id, email, display_name, role, phone,
  group_id, bus_id, bMustWorkToday, isPresentToday, description
}
loading, error, userStatusChannel
```

## Геттеры

- `isAdmin` — `role === 'admin'`
- `isCheckInRequired` — `!!userInfo.id && !userInfo.isPresentToday` (движок
  глобального check-in-перехвата, см. [[Группы-и-рабочий-день]])
- `userEmail`, `userId`

## Действия

Каждое действие — тонкая обёртка, вызывающая соответствующий метод
[[useUser]] и обновляющая локальное состояние/кэш:

- `loadUser(force)` — кэш → Supabase; при роли `admin` дополнительно
  подписывается на realtime-обновления (`subscribeToUserStatus()`).
- `assignUserToGroup(groupId, date)` / `assignUserToBus(busId, date)` /
  `updateUserPresence(status, date)` — точечные обновления
  [[user_group_day]] через `useUser.upsertScheduleField()`.
- `getUserDayInfo(date)` — расписание на произвольный день (не только
  сегодня).
- `clearUserCache()` — очистка LocalForage-кэша + `this.$reset()`.

## Почему именно так (`doc/migration_guide.md`)

Явно зафиксированное правило рефакторинга: **не** вызывать методы store
напрямую из компонентов там, где есть composable-эквивалент, **не**
создавать дублирующие computed поверх геттеров стора. Store — источник
реактивного состояния для шаблонов; логика загрузки/кэширования — в
`useUser()`, который вызывается явно в `onMounted()`/обработчиках.

## Связанные заметки

- [[useUser]]
- [[useSupabaseUser]]
- [[user_group_day]]
- [[users]]
- [[Модель-аутентификации]]
- [[Группы-и-рабочий-день]]
