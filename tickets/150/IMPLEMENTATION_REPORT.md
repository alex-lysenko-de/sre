# Измененные файлы

- `src/views/ArmbandView.vue`

# Новые файлы

Отсутствуют.

# Реализованные изменения

В списке "Kind auswählen" (`<label class="form-check-label">`, ранее
строки 56-59) однострочное представление ребёнка
`{{ child.name }} ({{ child.age }} J) — Armband: {{ child.band_id ?? '—' }}`
заменено на три отдельных блочных элемента:

```html
<label class="form-check-label" :for="'child-' + child.id">
  <div class="child-name">{{ child.name }}</div>
  <div class="child-meta">Alter: {{ child.age }}</div>
  <div class="child-meta">Armband Id: {{ child.band_id ?? '—' }}</div>
</label>
```

В `<style scoped>` добавлены классы `.child-name` (жирный шрифт) и
`.child-meta` (приглушённый цвет, `font-size: 0.9rem`) — без изменений
остального стиля файла.

`v-model="selectedChildId"`, `:value="child.id"`, `:id="'child-' + child.id"`,
`v-for="child in children"`, а также скрипт (`assignArmband()`,
`loadChildren()` и др.) не изменялись.

# Отклонения от плана

Отсутствуют — реализация точно соответствует примеру разметки и стилям
из `IMPLEMENTATION_PLAN.md`.

# Миграции

Отсутствуют — тикет не затрагивает БД/API.

# Проверки

- `npm run build` — проходит без ошибок (только предсуществующие
  предупреждения: chunk size >500kB для `index-*.js`, устаревшие данные
  `caniuse-lite`/`baseline-browser-mapping`, не связаны с этой правкой).
- Клик/тап по любой из трёх строк по-прежнему выбирает radio — стандартное
  поведение `<label for="...">`, кода обработки клика нет и не
  добавлялось.
- Проверка в узком viewport (DevTools mobile emulation) и ручной сценарий
  на реальном устройстве (выбрать ребёнка → "Armband zuordnen" → переход
  на `ChildDetail`) — вне возможностей текущей сессии (нет браузера/
  устройства), как и во всех предыдущих тикетах серии — отложена до
  проверки пользователем.
