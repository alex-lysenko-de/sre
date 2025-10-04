# WebAuthn Authentication App

Полноценная система аутентификации с WebAuthn (Face ID / Touch ID / биометрия), QR-кодами для регистрации и PWA поддержкой.

## 🚀 Особенности

- ✅ **WebAuthn аутентификация** - вход через биометрию (Face ID, Touch ID, Windows Hello)
- ✅ **QR-код регистрация** - одноразовые invite tokens
- ✅ **PWA** - работает как нативное приложение
- ✅ **Offline-first** - Service Worker для кеширования
- ✅ **Role-based access** - разделение прав (user/admin)
- ✅ **Multi-device** - управление несколькими устройствами
- ✅ **Ежедневная отметка** - требование входа раз в сутки
- ✅ **Secure Storage** - безопасное хранение токенов

## 📋 Требования

- Node.js 18+
- Supabase аккаунт
- HTTPS домен (для WebAuthn в production)

## 🛠 Установка

### 1. Клонирование и установка зависимостей

```bash
npm install
```

### 2. Настройка Supabase

#### 2.1 Создать проект в Supabase

1. Перейти на https://supabase.com
2. Создать новый проект
3. Скопировать URL и ключи

#### 2.2 Создать таблицы

Выполнить SQL из файла `database-schema.sql` в SQL Editor Supabase.

#### 2.3 Настроить Edge Function

```bash
# Установить Supabase CLI
npm install -g supabase

# Войти
supabase login

# Связать проект
supabase link --project-ref your-project-ref

# Создать Edge Function
supabase functions new auth

# Скопировать код из edge_function_auth.ts в functions/auth/index.ts

# Деплой
supabase functions deploy auth

# Установить секреты
supabase secrets set JWT_SECRET=your-random-secret-key-here
```

### 3. Настройка переменных окружения

Создать файл `.env`:

```bash
cp .env.example .env
```

Заполнить значения:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/auth
```

### 4. Запуск в dev режиме

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

⚠️ **Важно**: WebAuthn требует HTTPS в production. Для локальной разработки можно использовать:
- `localhost` (работает без HTTPS)
- ngrok для HTTPS туннеля: `ngrok http 3000`

## 📦 Production Build

```bash
npm run build
```

Готовые файлы будут в папке `dist/`.

## 🌐 Деплой

### Vercel

```bash
npm install -g vercel
vercel
```

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Cloudflare Pages

```bash
npm run build
# Загрузить dist/ через Cloudflare Pages Dashboard
```

## 🔐 Безопасность

### Важные моменты:

1. **HTTPS обязателен** для WebAuthn в production
2. **Service Role Key** хранится ТОЛЬКО в Edge Functions
3. **JWT Secret** должен быть криптографически случайным (минимум 32 байта)
4. **Invite токены** одноразовые и с коротким сроком жизни
5. **RLS (Row Level Security)** включен на всех таблицах

### Генерация секретов:

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Invite Token (используется автоматически в Edge Function)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 📱 PWA Установка

### iOS (Safari)

1. Открыть приложение в Safari
2. Нажать кнопку "Поделиться" (квадрат со стрелкой вверх)
3. Выбрать "На экран Домой"
4. Нажать "Добавить"

### Android (Chrome)

1. Открыть приложение в Chrome
2. Нажать меню (три точки)
3. Выбрать "Установить приложение" или "Добавить на главный экран"

### Desktop (Chrome/Edge)

1. Открыть приложение
2. Нажать иконку установки в адресной строке
3. Или: Меню → "Установить [название приложения]"

## 🎯 Использование

### Для администратора

1. Создать первого админа в БД вручную:

```sql
INSERT INTO public.users (display_name, role, active)
VALUES ('Admin User', 'admin', TRUE);
```

2. Зарегистрироваться через QR-код (создать invite через SQL или API)
3. Войти в админ-панель `/admin`
4. Генерировать QR-коды для новых пользователей

### Для пользователя

1. Получить QR-код от администратора
2. Отсканировать QR → переход на страницу регистрации
3. Ввести имя и подтвердить через биометрию
4. Готово! Теперь вход через биометрию

## 🔧 Troubleshooting

### WebAuthn не работает

- Проверить, что используется HTTPS (или localhost)
- Проверить поддержку браузером: https://caniuse.com/webauthn
- Включить биометрию в настройках устройства

### Edge Function ошибки

```bash
# Просмотр логов
supabase functions logs auth

# Проверка секретов
supabase secrets list
```

### Service Worker не обновляется

- Очистить кеш браузера
- Unregister Service Worker в DevTools
- Hard reload (Ctrl+Shift+R / Cmd+Shift+R)

## 📚 API Endpoints

### Edge Function `/auth`

- `POST /register/prepare` - Подготовка регистрации
- `POST /register/finish` - Завершение регистрации
- `POST /login/prepare` - Подготовка входа
- `POST /login/finish` - Завершение входа
- `POST /invite/generate` - Генерация invite (admin)
- `GET /users` - Список пользователей (admin)
- `POST /user/toggle-status` - Активация/деактивация (admin)
- `GET /devices/count` - Количество устройств

## 📄 Структура проекта

```
.
├── src/
│   ├── assets/          # Статические файлы
│   ├── components/      # Vue компоненты
│   ├── composables/     # Composables (useAuth)
│   ├── router/          # Vue Router
│   ├── views/           # Страницы
│   ├── App.vue          # Главный компонент
│   └── main.ts          # Точка входа
├── public/
│   ├── icons/           # PWA иконки
│   ├── manifest.json    # PWA manifest
│   └── service-worker.js # Service Worker
├── supabase/
│   └── functions/
│       └── auth/        # Edge Function
├── database-schema.sql  # SQL схема
└── vite.config.ts       # Vite конфигурация
```

## 🤝 Contributing

Pull requests приветствуются!

## 📝 License

MIT

## 👨‍💻 Автор

Создано с ❤️ для безопасной и удобной аутентификации

---

## 🎓 Дополнительные ресурсы

- [WebAuthn Guide](https://webauthn.guide/)
- [Supabase Docs](https://supabase.com/docs)
- [Vue 3 Docs](https://vuejs.org/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)