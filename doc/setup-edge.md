# 🚀 Подробное руководство: Деплой Edge Function в Supabase

## Шаг 1: Установка Supabase CLI

### Windows (PowerShell)
```powershell
# Через Scoop
scoop install supabase

# Или через npm
npm install supabase
```

### macOS
```bash
# Через Homebrew
brew install supabase/tap/supabase

# Или через npm
npm install -g supabase
```

### Linux
```bash
# Через npm
npm install -g  supabase

# Или напрямую
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

### Проверка установки
```bash
npx supabase --version
# Должно вывести версию, например: 1.123.4
```

---

## Шаг 2: Авторизация в Supabase

```bash
npx supabase login
```

Откроется браузер для авторизации. После успешной авторизации вернись в терминал.

---

## Шаг 3: Подготовка структуры проекта

### 3.1 Инициализация Supabase в проекте

```bash
# В корне твоего проекта
npx supabase init
```

Это создаст папку `supabase/` с конфигурацией.

### 3.2 Создание структуры для Edge Function

```bash
# Создать папку для функции
npx supabase functions new auth
```

Будет создана структура:
```
supabase/
├── functions/
│   └── auth/
│       └── index.ts
└── config.toml
```

### 3.3 Копирование кода Edge Function

Скопируй весь код из артефакта **"Edge Function - auth.ts"** в файл:
```
supabase/functions/auth/index.ts
```

---

## Шаг 4: Настройка связи с проектом Supabase

### 4.1 Получить Project Reference ID

1. Открой твой проект в [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейди в **Settings** → **General**
3. Скопируй **Reference ID** (например: `abcdefghijklmnop`)

### 4.2 Связать локальный проект с Supabase

```bash
npx supabase link --project-ref prlivcmqjqjypclkcovl
```

Где `prlivcmqjqjypclkcovl` — твой Project Reference ID.

Тебя попросят ввести пароль от базы данных (который ты создавал при создании проекта).

---

## Шаг 5: Установка секретов (Environment Variables)

Edge Function нуждается в секретных переменных. Установим их:

### 5.1 Генерация JWT Secret

```bash
# В терминале (Linux/macOS)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Или в PowerShell (Windows)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Скопируй результат (например: `BQB9J53cIESAD+vl0D7XmTxL3EDbXGQcHQZILoVzteE=`)

### 5.2 Получение Service Role Key

1. Открой [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейди в **Settings** → **API**
3. Найди секцию **Project API keys**
4. Скопируй **service_role** ключ (⚠️ **НЕ** anon public!)

### 5.3 Установка секретов через CLI

```bash
# JWT Secret
npx  secrets set JWT_SECRET="BQB9J53cIESAD+vl0D7XmTxL3EDbXGQcHQZILoVzteE="

# Supabase URL (замени на свой URL)
npx supabase secrets set BASE_URL="https://prlivcmqjqjypclkcovl.supabase.co"

# Service Role Key (замени на свой ключ)
npx supabase secrets set SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBybGl2Y21xanFqeXBjbGtjb3ZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDE0NzAxMiwiZXhwIjoyMDY5NzIzMDEyfQ.b3xnNfoIOc288HuuxNQzDXivNfiEDgFxq8XIylwYeQk"
```

### 5.4 Проверка установленных секретов

```bash
npx supabase secrets list
```

Должно показать список:
```
JWT_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

---

## Шаг 6: Деплой Edge Function

### 6.1 Базовый деплой

```bash
npx supabase functions deploy auth
```

### 6.2 Деплой с проверкой

```bash
# С верификацией JWT
supabase functions deploy auth --verify-jwt

# С debug логами
supabase functions deploy auth --debug
```

### 6.3 Ожидаемый вывод

```
Deploying function auth...
Function deployed successfully!
Function URL: https://prlivcmqjqjypclkcovl.supabase.co/functions/v1/auth
```

---

## Шаг 7: Проверка работы Edge Function

### 7.1 Тест через curl

```bash
curl -X POST https://your-project.supabase.co/functions/v1/auth/invite/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"role":"user","expiresInHours":24}'
```

### 7.2 Тест через Supabase Dashboard

1. Открой [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейди в **Edge Functions** (слева в меню)
3. Кликни на функцию **auth**
4. Нажми **Invoke** для тестирования

### 7.3 Просмотр логов

```bash
# В реальном времени
supabase functions logs auth --follow

# Последние 100 записей
supabase functions logs auth --limit 100
```

---

## Шаг 8: Обновление клиентского приложения

Обнови `.env` файл в Vue приложении:

```env
VITE_API_BASE_URL=https://prlivcmqjqjypclkcovl.supabase.co/functions/v1/auth
```

Замени `abcdefghijklmnop` на твой Project Reference ID.

---

## 🔧 Troubleshooting

### Проблема: "Failed to deploy function"

**Решение:**
```bash
# Проверь связь с проектом
supabase projects list

# Пере-линкуй проект
supabase link --project-ref YOUR_PROJECT_REF
```

### Проблема: "Invalid JWT"

**Решение:**
```bash
# Проверь секреты
supabase secrets list

# Пересоздай JWT_SECRET
supabase secrets set JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
```

### Проблема: "CORS errors"

**Решение:** Убедись, что в Edge Function есть обработка OPTIONS:

```typescript
if (req.method === "OPTIONS") {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
```

### Проблема: "Cannot find module"

**Решение:** Проверь импорты в `index.ts`. Все URL должны быть полными:

```typescript
// ✅ Правильно
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ❌ Неправильно
import { serve } from "http/server";
```

---

## 📝 Полезные команды

```bash
# Список всех функций
supabase functions list

# Удалить функцию
supabase functions delete auth

# Скачать логи в файл
supabase functions logs auth > logs.txt

# Тест локально (перед деплоем)
supabase functions serve auth

# Обновление CLI
npm update -g supabase
```

---

## 🎯 Быстрая шпаргалка (TL;DR)

```bash
# 1. Установка
npm install -g supabase

# 2. Авторизация
supabase login

# 3. Инициализация
supabase init
supabase functions new auth

# 4. Копирование кода в supabase/functions/auth/index.ts

# 5. Линк проекта
supabase link --project-ref YOUR_PROJECT_REF

# 6. Установка секретов
supabase secrets set JWT_SECRET="your-secret"
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# 7. Деплой
supabase functions deploy auth

# 8. Проверка
supabase functions logs auth
```

---

## 🔐 Важные замечания по безопасности

1. **НИКОГДА** не коммить `.env` или секреты в git
2. **Service Role Key** имеет полный доступ к БД - храни его безопасно
3. **JWT_SECRET** должен быть криптографически случайным (минимум 32 байта)
4. Используй разные секреты для development и production

---

## 📚 Дополнительные ресурсы

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)

---

Если возникнут проблемы на любом из этих шагов - дай знать, помогу разобраться! 🚀

