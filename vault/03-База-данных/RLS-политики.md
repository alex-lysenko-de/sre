# RLS-политики

> Источники: `doc/database_migration_config_rls.sql`, `doc/db/days_rls.sql`
> (тикет 102), `doc/db/headcount_presence_morning.sql` (тикет 106).
> `doc/users.sql` также содержит RLS для [[users]], но не цитируется здесь —
> файл содержит реальные учётные данные администратора (см. `_Конвенции.md`).

Row Level Security — основной механизм авторизации на уровне данных,
дополняющий проверки на уровне роутера (`meta.requiresAuth`/`requiresAdmin`,
см. [[Карта-маршрутов]]). Общий паттерн проверки роли в политиках:

```sql
EXISTS (
  SELECT 1 FROM public.users
  WHERE users.user_id = auth.uid()
  AND users.role = 'admin'
  AND users.active = true
)
```

## [[config]]

`SELECT` — публичный (`TO public USING (true)`) — нужен `/info` без сессии.
`INSERT`/`UPDATE`/`DELETE` — только активные admin. Заменяет ранее чисто
клиентскую проверку `isAdmin` в `stores/config.js`.

## [[days]] (тикет 102)

`SELECT` — любой `authenticated`. `ALL` (insert/update/delete) — только
активные admin. Добавлена явная `DELETE`-политика — до этого её отсутствие
маскировало неудачное удаление как успех (PostgREST не считает «0 строк
затронуто RLS» ошибкой), см. [[days]].

## [[children_today]] (тикет 106 — Kopfzählung)

До тикета 106 таблица была доступна на запись только через триггер
`on_scan_insert` (обычные пользователи — SELECT-only). Ручная отметка
присутствия (`HeadcountView.vue`) впервые потребовала прямой записи от
Betreuer:

- `own_group_update_presence_now` (UPDATE) и `own_group_insert_presence_now`
  (INSERT) — разрешают запись, только если у вызывающего есть запись в
  [[user_group_day]] на сегодня с тем же `group_id`, что и у строки
  `children_today`, и `"isPresentToday" = 1`; либо если вызывающий — admin.
- INSERT нужен для случая, когда ребёнок ещё не был сканирован сегодня, и
  Betreuer отмечает его вручную первым — тогда строки в `children_today`
  ещё не существует.

## Общий паттерн для admin-only таблиц

`children_today`/`reset_events`/`user_group_day` и подобные повторяют схожую
модель: `SELECT` — любой `authenticated`, запись — либо владелец
контекста (своя группа на сегодня), либо admin без ограничений.

## Почему RLS, а не только проверки в роутере

Проверки в `router.beforeEach` (см. [[Карта-маршрутов]],
[[Модель-аутентификации]]) — это только UX-уровень: они решают, какой
экран показать, но не мешают прямому запросу к Supabase в обход UI. RLS —
единственная граница, которая реально исполняется сервером на каждый
запрос. Показательный случай — [[config]]: клиентская проверка `isAdmin` в
`stores/config.js` была признана недостаточной и заменена RLS-политикой как
единственной точкой принудительного контроля записи (см.
`doc/database_migration_config_rls.sql`); тот же паттерн — заявленная в
`doc/db/headcount_presence_morning.sql` причина добавления RLS для
[[children_today]] при появлении Kopfzählung.

## Связанные заметки

- [[config]]
- [[days]]
- [[children_today]]
- [[users]]
- [[user_group_day]]
- [[Карта-маршрутов]]
- [[Модель-аутентификации]]
