
## 🧩 **Постановка задачи**

Создать функциональность для **идентификации и привязки браслетов к детям** через QR-код.

### 🎯 Цель

Позволить воспитателю (пользователю с ролью «Betreuer») при сканировании QR-кода на браслете:

1. Определить, **привязан ли браслет к ребенку**.
2. Если нет — **привязать** браслет к ребенку из **своей группы**.
3. Если да — показать **страницу ребенка** с возможностями редактирования и отметки присутствия.

---

## 🧠 **Основная логика работы**

### 1️⃣ Сканирование QR-кода

QR-код содержит URL вида:
`/armband/:id`
где `:id` — уникальный идентификатор браслета.

### 2️⃣ Определение статуса

При открытии страницы `/armband/:id` (ArmbandView.vue) выполняется запрос в базу данных (через Supabase):

* Проверяем, **есть ли запись** ребенка с `band_id = id`. (select id, name , age, group_id from children where band_id = :id)
* Если **найден** → переходим к **декоративной карточке ребенка**.
* Если **не найден** → показываем **форму привязки браслета**.

### 3️⃣ Привязка браслета

Форма включает:

* Выпадающий список (`<select>`) детей из **группы текущего пользователя**.
user_group_id = userStore.userInfo.group_id 
select id, name , age, band_id  from children where group_id = :user_group_id
* Кнопку `«Armband zuordnen» (Привязать браслет)`.

После выбора ребенка:

* Отправляем запрос через Supabase (`update children set band_id = :id where child_id = :childId`).
* Показываем сообщение об успехе.
* Перенаправляем на `/child/:id`. (ChildDetailView.vue)

### 4️⃣ Страница ребенка (`/child/:id`)

Отображает:

* Имя, возраст, фото и группу ребенка.
* Кнопки действий:

  * ✏️ **Bearbeiten (Редактировать)**
  * ✅ **Anwesend markieren (Отметить присутствие)**
  * ↩️ **Zurück zur Gruppe (Назад к списку)**

---

## 🧭 **Архитектура и маршруты**

### 📁 **views/**

* `ArmbandView.vue` → страница для `/armband/:id`
* `ChildDetailView.vue` → страница для `/child/:id`
* `GroupEditView.vue` → страница группы воспитателя (`/group-edit/:id`)

### 📁 **composables/**

* `useArmband.js` → работа с таблицей браслетов (реализовано, объединяет все функции ниже в одном файле)

  * `getBraceletStatus(bandId)`
  * `getChildrenByGroup(groupId)`
  * `getChildDetails(childId)`
  * `checkBraceletAlreadyBound(bandId)`
  * `assignBraceletToChild(childId, bandId)`
  * `recordChildPresence(userId, childId, bandId, busId)`

Отдельного `useChildren.js`/`useAuth.js` нет — данные текущего пользователя берутся из `stores/user.js` (Pinia).

### 📁 **router/** (актуальные маршруты, `src/router/index.js`)

```js
[
  { path: '/armband/:id', name: 'Armband', component: ArmbandView },
  { path: '/armband-connect/:id', name: 'ArmbandConnect', component: ArmbandConnectView },
  { path: '/child/:id', name: 'ChildDetail', component: ChildDetailView },
  { path: '/group-edit/:id?', name: 'GroupEdit', component: GroupEditView },
]
```

### 📁 **stores/**

* `user.js` → хранит данные авторизованного воспитателя (включая `group_id`), реализовано через Pinia. Отдельного `children.js`-стора нет.

---

## 🧱 **Сценарий использования**

| Сценарий                                            | Действие                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Воспитатель сканирует QR-код нового браслета        | Приложение открывает `/armband/:id`, видит что браслет не привязан → показывает форму выбора ребенка. |
| Воспитатель выбирает ребенка и нажимает «Привязать» | Supabase обновляет запись в таблице `children`.                                                        |
| Браслет уже привязан                                | `/armband/:id` перенаправляет на `/child/:id` и показывает карточку ребенка.                     |

---

## 🧰 **Технические заметки**

* Все текстовые строки — на **немецком**, например:

  * `"Dieser Armband ist noch keinem Kind zugeordnet."`
  * `"Kind auswählen"`, `"Armband zuordnen"`.
* Форма привязки реализована непосредственно в `views/ArmbandConnectView.vue`, отдельный `components/ArmbandAssignForm.vue` не выделялся.

---

> **Status (Stand: 2026-07):** Kernlogik ist implementiert (`useArmband.js`, `ArmbandView.vue`, `ArmbandConnectView.vue`). Dieses Dokument beschreibt weiterhin die ursprüngliche Zielarchitektur und dient als Referenz.

