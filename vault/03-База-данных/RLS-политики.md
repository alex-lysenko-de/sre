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

## ⚠ Неотозванные широкие legacy-политики ослабляют «свою группу»

По итогам ревью тикета 108 (`tickets/108/REVIEW_REPORT.md`, Major 3) —
описанная выше модель «своя группа или admin» для `children_today`
формально верна, но **не является фактическим ограничением**, потому что
рядом с `own_group_update_presence_now`/`own_group_insert_presence_now` в
БД остались более старые permissive-политики того же действия:

- `children_today` — `"Allow authenticated users to update/insert/delete
  children_today"`, все три `USING/WITH CHECK (true)`, `TO authenticated`,
  без проверки группы или роли.
- То же самое для `groups_today` (`insert`/`update`/`delete`) и
  `reset_events` (`insert`/`update`/`delete`), и для `children`
  (`"Allow authenticated users to modify children"`, `USING/WITH CHECK
  (true)`).
- `days` — `"Enable insert for authenticated users"` /
  `"Enable update for authenticated users"` (`TO authenticated`, `USING
  (true)`, без проверки роли) существуют одновременно с корректной
  `"Allow admins to manage days"` (admin-only).

PostgreSQL объединяет несколько permissive-политик одного действия через
**OR** — значит для перечисленных таблиц действует самая широкая из них:
любой `authenticated` пользователь (не обязательно admin, не обязательно
Betreuer этой группы) может писать в любую строку. Узкая политика
`own_group_*` в реальности ничего не ограничивает, пока legacy-политики не
отозваны. Это не баг триггеров и не ошибка кода — сами `own_group_*`
написаны корректно, но перекрываются более старыми правилами, оставшимися
с ранних версий схемы (до тикета 106). Тот же паттерн независимо
обнаружен и для [[config]] (см. её собственную заметку — там ещё и
`INSERT`/`UPDATE` разрешены вовсе без `TO authenticated`, то есть
анонимным запросам).

**Практический вывод:** для новых участников команды — не полагаться на
описание «своя группа или admin» как на фактическую границу доступа;
реальная граница сейчас — «любой авторизованный пользователь», пока
legacy-политики не удалены явной миграцией.

## Почему RLS, а не только проверки в роутере

Проверки в `router.beforeEach` (см. [[Карта-маршрутов]],
[[Модель-аутентификации]]) — это только UX-уровень: они решают, какой
экран показать, но не мешают прямому запросу к Supabase в обход UI. RLS —
единственный механизм, который в принципе исполняется сервером на каждый
запрос (в отличие от клиентских проверок). Показательный **замысел** —
[[config]]: клиентская проверка `isAdmin` в `stores/config.js` была
признана недостаточной, и добавлена корректная admin-only RLS-политика
(`doc/database_migration_config_rls.sql`); тот же мотив — заявленная в
`doc/db/headcount_presence_morning.sql` причина добавления RLS для
[[children_today]] при появлении Kopfzählung. **На практике**, впрочем, эта
цель не достигнута полностью — как показано выше, старые permissive-политики
для `config` (и для `children_today`/`groups_today`/`reset_events`/
`children`/`days`) остались неотозванными и всё ещё разрешают запись в
обход новых узких политик. RLS как *механизм* — правильное место для
контроля; но по состоянию на тикет 108 он не везде реально ограничивает
запись так, как задумано.

## Связанные заметки

- [[config]]
- [[days]]
- [[children_today]]
- [[users]]
- [[user_group_day]]
- [[Карта-маршрутов]]
- [[Модель-аутентификации]]
