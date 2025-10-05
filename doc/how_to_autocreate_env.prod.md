Отлично 👌
Сейчас добавим в твой GitHub Action поддержку **продакшн переменных окружения** (`.env.production`) — чтобы при деплое использовались правильные Supabase ключи, URL API и т.д.

---

## 🔐 Как добавить `.env.production` в автоматический деплой

### 1. Создай файл `.env.production`

В корне проекта создай файл:

```
.env.production
```

И вставь туда **боевые ключи** (из Supabase):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/auth
```

⚠️ **Не коммить** этот файл в GitHub!
(Добавим его в `.gitignore`, чтобы он не попал в репозиторий.)

---

### 2. Добавь `.env.production` в `.gitignore`

В файл `.gitignore` добавь строку:

```
.env.production
```

---

### 3. Добавь секреты в GitHub

1. Перейди в репозиторий → **Settings → Secrets and variables → Actions → New repository secret**
2. Создай три секрета:

   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
   * `VITE_API_BASE_URL`
3. Вставь туда соответствующие значения.

---

### 4. Обнови workflow `.github/workflows/deploy.yml`

Вот новая версия с автоматической генерацией `.env.production` на основе GitHub Secrets 👇

```yaml
name: Deploy Vue/Vite app to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Create .env.production file
        run: |
          echo "VITE_SUPABASE_URL=${{ secrets.VITE_SUPABASE_URL }}" >> .env.production
          echo "VITE_SUPABASE_ANON_KEY=${{ secrets.VITE_SUPABASE_ANON_KEY }}" >> .env.production
          echo "VITE_API_BASE_URL=${{ secrets.VITE_API_BASE_URL }}" >> .env.production

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

### 5. Зафиксируй и запушь изменения

```bash
git add .github/workflows/deploy.yml .gitignore
git commit -m "Добавлен авто-деплой с .env.production из GitHub Secrets"
git push origin main
```

---

### ✅ Результат

Теперь при каждом пуше в `main`:

1. GitHub Actions создаёт `.env.production` из Secrets.
2. Собирает проект с `npm run build`.
3. Публикует результат в `gh-pages`.
4. Всё происходит автоматически — без ручных команд.

---

Хочешь, я покажу, как добавить **автоматический Service Worker version bump** (чтобы PWA обновлялась без ручной очистки кэша)?
8