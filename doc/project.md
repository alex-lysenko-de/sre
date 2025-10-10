
# План — тикеты (выполнимые задачи, каждая — отдельный тикет)

---

## Тикет 1 — «Layout: MainView + Nested routes»

**Цель:** Ввести `MainView.vue` как контейнер рабочей зоны; вынести навигацию и вложенные View туда.

**Описание работ:**

* Создать `src/views/MainView.vue` — layout с sidebar/topbar и `<router-view/>` для дочерних view.
* Добавить маршруты `/main` с дочерними:

  * `/main/scan` → `ScanView.vue`
  * `/main/children` → `ChildrenView.vue`
  * `/main/child/:id` → `ChildDetailView.vue`
  * `/main/bind` → `BindBraceletView.vue`
  * `/main/users` → `UsersView.vue` (meta: admin)
* Обновить `src/router/index.js` чтобы использовать meta-права (`role: ['user','admin']` и т.п.). Router уже содержит глобальный guard — расширяем его, а не дублируем логику. 

**Acceptance criteria:**

* при заходе на `/main` отображается layout (только для авторизованных).
* доступ к `/main/users` запрещён для non-admin (редирект на `/info`).
* навигация в layout ведёт к дочерним страницам.

**Подзадачи:**

* создать файл MainView.vue (простая разметка + slots)
* обновить router (добавить children)
* покрыть тестом ручную проверку прав (ручное QA)

---

## Тикет 2 — «Flow сканирования (ScanView)»

**Цель:** Реализовать логику обработки QR-параметра `?n=...` и поведение для `guest` / `user` / `admin` согласно `project.md`. 

**Описание работ:**

* Создать `src/views/ScanView.vue`.
* На `mounted()`:

  1. читать `n` из `window.location.search` или `route.query.n`.
  2. получать текущую сессию через `supabase.auth.getSession()` и роль из таблицы `users`.
  3. если роль = `guest` (нет сессии) → `router.push('/info?n=...')` (никаких записей в БД).
  4. иначе (user/admin):

     * найти запись браслета в `c_bands` по полю `code` (или `number`) == `n`.
     * если браслет не найден или не привязан к ребёнку → показать UI: «браслет не привязан» + кнопки `Назад` / `Привязать` (переход на `/main/bind?n=...`).
     * если привязан → показать карточку ребёнка (группа, имя, возраст, schwimmer) и **создать запись в `scans`** с полями: band_id, child_id, user_id, created_at (NOW()), date (YYYY-MM-DD), type (по умолчанию какой-то).
     * показать успешный ответ (тост/уведомление) и список последних сканов данного ребёнка (опционально).

**Acceptance criteria:**

* при `?n=` для guest — редирект `/info?n=...`, никаких изменений в БД.
* при `?n=` для user/admin с привязанным браслетом — создаётся запись в `scans`, и UI отображает данные ребёнка.
* при `?n=` для user/admin без привязки — показывается приглашение к привязке и переход к `BindBraceletView`.

**Примеры запросов (Supabase / JS):**

```js
// 1) Найти браслет по коду (n)
const { data: band } = await supabase
  .from('c_bands')
  .select('*')
  .eq('code', n)
  .single()

// 2) Найти ребёнка по band_id
const { data: child } = await supabase
  .from('children')
  .select('*, groups(name)')
  .eq('band_id', band.id)
  .single()

// 3) Вставить скан
await supabase.from('scans').insert({
  created_at: new Date().toISOString(),
  date: new Date().toISOString().slice(0,10), // YYYY-MM-DD
  user_id: currentUserId, // users.id
  child_id: child.id,
  band_id: band.id,
  type: 1
})
```

**Доп. логика:**

* предотвращать повторную запись дубликата (например, если один и тот же браслет отсканирован повторно в течение 5 секунд — игнорировать) — минимальная «debounce» защита.
* логировать результат (использовать `logApi`).

---

## Тикет 3 — «BindBraceletView (привязка браслета к ребёнку / создание ребёнка)»

**Цель:** Удобный экран, на который переводит ScanView, если браслет не привязан.

**Описание:**

* `src/views/BindBraceletView.vue`:

  * получает `n` из query.
  * показывает информацию о браслете (если он существует) или даёт возможность создать новый браслет.
  * две опции:

    1. выбрать существующего ребёнка из списка (селектор) и привязать (update children set band_id = band.id).
    2. создать нового ребёнка (форма: name, age, schwimmer, group_id) — затем insert в `children` с band_id = band.id.
  * после успешной привязки — редирект/открыть `ScanView` чтобы снова записать скан (или сразу записать скан при подтверждении).

**Acceptance criteria:**

* можно привязать браслет к существующему ребёнку.
* можно создать ребёнка и привязать.
* ссылки/кнопки возвращают к ScanView и показывают успешный результат.

---

## Тикет 4 — «Children CRUD (ChildrenView + ChildDetailView)»

**Цель:** Интерфейс для просмотра/редактирования/создания/удаления детей.

**Описание:**

* `ChildrenView.vue` — таблица/карточки детей с фильтрами (по группе, по браслету).
* `ChildDetailView.vue` — редактирование: имя, возраст, schwimmer, notes, group_id, band_id (замена браслета).
* возможность массового импорта/экспорта CSV (опционально).
* права: `user` и `admin` могут CRUD детей; `guest`/view-only.

**Acceptance criteria:**

* добавить/редактировать/удалять ребёнка работает и отражается в `children` таблице.
* при удалении ребёнка все связанные `scans` корректно обрабатываются (FK CASCADE или soft-delete — на выбор).

---

## Тикет 5 — «Users & Admin (UsersView, роли, управление)»

**Цель:** Интерфейс админа для управления пользователями (активация/деактивация, смена роли, просмотр last_seen).

**Описание:**

* `UsersView.vue` — список пользователей (`users` таблица), фильтр, кнопки «deactivate/activate», «set admin/user».
* использовать существующий invite-generator (в репо уже есть) для приглашений. 
* админ может просматривать статистику сканов (переход в AdminDashboard).

**Acceptance criteria:**

* админ может менять поле `role` и `active` в `users`.
* изменение роли/active корректно отражается в приложении (доступ к маршрутам).

---

## Тикет 6 — «DB: миграции и новые таблицы»

**Цель:** Привести структуру базы в соответствие с функциональным планом. (В `project.md` уже есть DDL для `children`, `users`, `scans`, `days` — используем и дополняем). 

**Список таблиц (DDL-примеры)**

### `c_bands` — браслеты (если сейчас нет)

```sql
create table public.c_bands (
  id bigint generated by default as identity primary key,
  code text not null unique,     -- например '001', '100' (код QR)
  label text,
  active boolean default true,
  created_at timestamptz default now()
);
create index idx_c_bands_code on public.c_bands using btree(code);
```

### `groups` — группы детей

```sql
create table public.groups (
  id bigint generated by default as identity primary key,
  name text not null,
  created_at timestamptz default now()
);
```

### `children` — (как в project.md, но добавляю явное поле `dob` и `gender` опционально)

```sql
create table public.children (
  id bigint generated by default as identity primary key,
  created_at timestamptz default now(),
  name varchar,
  age smallint default 0,
  schwimmer boolean default false,
  status smallint default 0,
  notes text default '',
  group_id bigint references public.groups(id) on delete set null,
  band_id bigint references public.c_bands(id) on update cascade on delete set null
);
```

### `scan_type` — типы сканов

```sql
create table public.scan_type (
  id smallint primary key,
  name text not null
);
insert into scan_type (id,name) values (1,'present'),(2,'bus_in'),(3,'bus_out');
```

### `scans` — как в project.md (немного уточню поля)

```sql
create table public.scans (
  id bigint generated by default as identity primary key,
  created_at timestamptz default now(),
  date varchar not null, -- YYYY-MM-DD
  user_id bigint references public.users(id) on update cascade on delete set null,
  child_id bigint references public.children(id) on update cascade on delete cascade,
  band_id bigint references public.c_bands(id) on update cascade on delete set null,
  bus_id smallint null,
  type smallint references public.scan_type(id) on update cascade on delete set null,
  extra jsonb null
);
create index idx_scans_child_date on public.scans(child_id,date);
```

### `days` — (как в project.md)

```sql
create table public.days (
  id bigint generated by default as identity primary key,
  created_at timestamptz default now(),
  date varchar,
  name varchar,
  abfahrt time,
  ankommen time,
  description text
);
```

**Acceptance criteria:**

* все таблицы созданы через миграции;
* внешние ключи и индексы настроены;
* тестовый сценарий: выполнить скан (вручную) — запись появляется в `scans`.

**Примечание:** в `project.md` есть DDL-фрагменты для `children`, `users`, `scans`, `days` — используем их как базу. 

---

## Тикет 7 — «Безопасность: RLS и политики доступа (Supabase)»

**Цель:** Включить Row Level Security и политики, чтобы пользователи могли записывать сканы только при наличии прав.

**Рекомендации (пример):**

* Включить RLS для `scans`, `children`, `c_bands`.
* Политика insert для `scans`: разрешить вставку если:

  * текущий auth.uid = users.user_id и users.active = true (или используя service_role для серверных функций).
* Для чтения детей — разрешать чтение для всех авторизованных (но возможно ограничить по группе? зависит от требований).

**Acceptance criteria:**

* простые политики настроены, тесты insert/deny проходят.

---

## Тикет 8 — «Логика дедупликации сканов и UX»

**Цель:** избежать множества одинаковых записей при многократном сканировании.

**Описание:**

* при вставке скана — сначала проверить, нет ли последнего скана по этому браслету/ребёнку в последние N секунд (напр. 5–10 сек). Если есть — обновить `created_at` или вернуть «already scanned» UI.
* на фронтенде — кнопка «Scan again» с debounce.

**Acceptance criteria:**

* при двукратном сканировании быстро друг за другом — создаётся только одна запись или создаётся пометка «повторный скан» (по бизнес-правилу).

---

## Тикет 9 — «Тесты, QA и acceptance-сценарии»

**Цель:** покрыть основные сценарии manual+automated tests.

**Сценарии:**

* guest с `?n=...` → редирект на `/info?n=...` (нет записей).
* user сканирует привязанный браслет → запись в `scans`.
* user сканирует непроверенный браслет → предлагает привязку, выполняется привязка и затем создаётся scan при подтверждении.
* админ создает/деактивирует пользователя → доступ меняется.

**Acceptance criteria:** все сценарии пройдены вручную; написать тест-кейсы.

---

# Подробности: какие таблицы будут создаваться / уже есть (адаптация из project.md)

* `users` — уже в проекте (биндинг к `auth.users`), структура в `project.md`. 
* `children` — DDL в `project.md` (имеет `band_id` на `c_bands`). 
* `scans` — DDL в `project.md`. Поле `date` совпадает с `days.date`. 
* **Новые/доп. таблицы**: `c_bands`, `groups`, `scan_type`, `buses` (если нужен), `days` (есть в project.md). Я предлагаю заполнить `scan_type` начальными значениями (present/bus_in/bus_out).

(Полный DDL см. раздел «DB: миграции» выше.)

---

# Архитектурные best-practices, применимые к вашему кейсу

1. **Thin View, fat services:** не засовывать бизнес-логику в шаблон Vue. `ScanView` — orchestrator; реальные DB-операции через отдельный слой (утилиты / modules / composables), например `useScan()` / `useChildren()`. Это упростит тестирование.
2. **Разделяй ответственность:** `MainView` = layout; всё поведение — в дочерних view и composables.
3. **Router для авторизации:** маршрутизация + meta роли — хорошая точка входа (как вы уже делаете). Не перемещайте всю ветвящуюся логику туда — только права и редиректы. Конкретную логику скана оставляйте в `ScanView`. 
4. **Идемпотентность вставок:** сервер/клиент должны защищаться от дублей (см. дедупликацию).
5. **Realtime / подписки:** модуль `useConfig()` уже использует realtime. Можно добавить realtime для `scans` (админская дашбордная панель). 
6. **Лёгкая интеграция offline/PWA:** вы уже регистрируете SW; подумать о кэше на случай временной потери связи (store операции в queue и синкать). 

---

# Что делаем следующим шагом (практически, что я могу сделать сейчас)

Могу сразу (сделать по вашему желанию, отмечаю опции — выбирайте любую, и я сгенерирую файлы прямо сейчас):

1. Сгенерировать `MainView.vue` + обновить `router/index.js` (с шаблоном children routes).
2. Сгенерировать `ScanView.vue` — со всей логикой чтения `?n`, проверкой роли, поиском браслета/ребёнка и вставкой записи в `scans` (включая обработку дублей).
3. Подготовить SQL-миграцию (файл) с DDL для всех таблиц, индексов и базовыми записями в `scan_type`.
4. Сгенерировать `BindBraceletView.vue` skeleton + необходимые composables (`useChildren`, `useBands`).

Скажите, какой из пунктов хотите получить прямо сейчас — и я его сразу сгенерирую (Vue-файлы, SQL). Если не хотите выбирать — начну с `MainView.vue + router` и `ScanView.vue` (самый логичный минимум для рабочего flow).

---

Если нужно, могу также:

* добавить примеры RLS-политик для Supabase;
* подготовить набор тест-кейсов в формате тикетов/Check-list;
* сгенерировать начальные mock-данные для разработки.

---

Небольшая ремарка: я опирался на `project.md` (логика QR/сканов и таблицы) и текущее состояние репо (роутер/авторизация/invite-функции).  
