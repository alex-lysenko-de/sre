# App Stadtranderholung. Triggers

## 📘 Техническое задание: система учёта детей, их сканирования и ежедневных пересчётов

---

### 1️⃣ Таблица `children`

**Назначение:**
Хранит **статическую информацию** о всех детях лагеря.

**Изменяется только вручную** — администратором или системой регистрации.

**Колонки:**

* `id` — уникальный ID ребёнка
* `created_at` — дата регистрации
* `name`, `age`, `schwimmer`, `notes` — личные данные
* `group_id` — принадлежность к группе
* `band_id` — уникальный браслет (QR-код)

**Логика:**

* Каждому ребёнку соответствует один браслет (`band_id` unique).
* При сканировании система по `band_id` определяет `child_id`.

---

### 2️⃣ Таблица `scans`

**Назначение:**
Фиксирует **каждое сканирование браслета**.

**Основные поля:**

* `child_id` — ссылка на `children.id`
* `bus_id` — если сканирование производится в автобусе
* `type` — тип сканирования always == 1(зарезервировано под спец.режимы)
* `created_at` — время сканирования

---

#### 🔁 Триггер `on_scan_insert`

При **добавлении записи** в таблицу `scans`:

1. Проверяет, есть ли запись о ребёнке в `children_today`.

   * Если **нет** — создаёт новую запись:

     * `child_id` = из `scans`
     * `group_id` = из `children`
     * `bus_today` = `bus_id`
     * `presence_today = 1`
     * `presence_now = 1`
     * `user_id = scans.user_id`
   * Если **есть** — обновляет:

     * `presence_now = 1`
     * `bus_now` = `bus_id`
     * `user_id` = `scans.user_id`
2. После обновления `children_today` триггер автоматически вызовет обновление в `groups_today`.

---

### 3️⃣ Таблица `children_today`

**Назначение:**
Кэш-таблица с оперативной информацией о детях на текущий день.
Создаётся и обновляется автоматически при сканировании.

**Поля:**

* `child_id` — уникален (1 ребёнок = 1 запись в день)
* `presence_today` — был ли ребёнок сегодня (1/0)
* `presence_now` — находится ли он сейчас
* `bus_today` / `bus_now` — транспортная информация
* `user_id` — кто отсканировал или обновил запись

---

#### 🔁 Триггер `on_children_today_change`

Срабатывает **при INSERT или UPDATE**:

1. Определяет `group_id` ребёнка.
2. Считает общее количество детей этой группы:

   ```sql
   SELECT COUNT(*) FROM children_today WHERE group_id = NEW.group_id AND presence_today = 1;
   SELECT COUNT(*) FROM children_today WHERE group_id = NEW.group_id AND presence_now = 1;
   ```
3. Обновляет или вставляет запись в `groups_today`:

   * Если группы нет → создаёт
   * Если есть → обновляет `children_today`, `children_now`, `user_id`

---

### 4️⃣ Таблица `groups_today`

**Назначение:**
Хранит сводную информацию по каждой группе:

* Сколько детей **всего пришло сегодня**
* Сколько детей **находится сейчас**

**Обновляется только триггерами** из `children_today`.

---

### 5️⃣ Таблица `reset_events`

**Назначение:**
Хранит записи о событиях "пересчёта / сброса".

**Типы событий:**

* `event_type = 0` → **total reset**  - всё обнуляется ( , )
* `event_type = 1` → **успешный сброс** — сохраняются итоги дня

---

#### 🔁 Триггер `on_reset_event_insert`

При добавлении новой записи:

1. Если `event_type = 0`:

   * delete * from table children_today
   * delete * from table groups_today
   * (всё очищается, system is ready for a new day)


2. Если `event_type = 1`:

   * Если это **первый сброс за день**:

     * `groups_today.children_today = groups_today.children_now`
     * `groups_today.children_now = 0`
   * Если **повторный сброс**:

     * просто `groups_today.children_now = 0`
   * Также:

     * `children_today.presence_now = 0`

---

## ⚙️ Реализация: SQL-триггеры и функции

---

### 1️⃣ Функция и триггер для `scans`

```sql
CREATE OR REPLACE FUNCTION on_scan_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO children_today (user_id, child_id, group_id, presence_today, presence_now, bus_today, bus_now)
  VALUES (
    NEW.user_id,
    NEW.child_id,
    (SELECT group_id FROM children WHERE id = NEW.child_id),
    1, 1,
    NEW.bus_id, NEW.bus_id
  )
  ON CONFLICT (child_id) DO UPDATE
    SET presence_now = 1,
        bus_now = EXCLUDED.bus_now,
        user_id = EXCLUDED.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_on_scan_insert
AFTER INSERT ON scans
FOR EACH ROW
EXECUTE FUNCTION on_scan_insert();
```

---

### 2️⃣ Функция и триггер для `children_today`

```sql
CREATE OR REPLACE FUNCTION on_children_today_change()
RETURNS TRIGGER AS $$
DECLARE
  cnt_today INT;
  cnt_now INT;
BEGIN
  SELECT COUNT(*) INTO cnt_today FROM children_today WHERE group_id = NEW.group_id AND presence_today = 1;
  SELECT COUNT(*) INTO cnt_now FROM children_today WHERE group_id = NEW.group_id AND presence_now = 1;

  INSERT INTO groups_today (user_id, group_id, children_today, children_now)
  VALUES (NEW.user_id, NEW.group_id, cnt_today, cnt_now)
  ON CONFLICT (group_id) DO UPDATE
    SET children_today = EXCLUDED.children_today,
        children_now = EXCLUDED.children_now,
        user_id = EXCLUDED.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_on_children_today_change
AFTER INSERT OR UPDATE ON children_today
FOR EACH ROW
EXECUTE FUNCTION on_children_today_change();
```

---

### 3️⃣ Функция и триггер для `reset_events`

```sql
CREATE OR REPLACE FUNCTION on_reset_event_insert()
RETURNS TRIGGER AS $$
DECLARE
  resets_today INT;
BEGIN
  SELECT COUNT(*) INTO resets_today
  FROM reset_events
  WHERE day = NEW.day AND id <> NEW.id;

  IF NEW.event_type = 0 THEN
    -- Ошибочный сброс
    UPDATE children_today SET presence_now = 0;
    UPDATE groups_today SET children_now = 0;

  ELSIF NEW.event_type = 1 THEN
    -- Успешный сброс
    IF resets_today = 0 THEN
      UPDATE groups_today SET children_today = children_now, children_now = 0;
    ELSE
      UPDATE groups_today SET children_now = 0;
    END IF;
    UPDATE children_today SET presence_now = 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_on_reset_event_insert
AFTER INSERT ON reset_events
FOR EACH ROW
EXECUTE FUNCTION on_reset_event_insert();
```

---

## ✅ ИТОГ: общая логика работы

| Таблица          | Источник данных     | Когда обновляется | Действие                             |
| ---------------- | ------------------- | ----------------- | ------------------------------------ |
| `children`       | вручную             | вручную           | справочник                           |
| `scans`          | при сканировании    | постоянно         | добавляет/обновляет `children_today` |
| `children_today` | из `scans`          | по каждому скану  | добавляет/обновляет текущие данные   |
| `groups_today`   | из `children_today` | при изменении     | агрегирует данные по группам         |
| `reset_events`   | админ вручную       | по завершении дня | обнуляет/фиксирует состояние         |

----
