# 🔒 Настройка HTTPS для локальной разработки

WebAuthn **требует HTTPS** (кроме localhost). Вот несколько способов настроить HTTPS для dev.

## Способ 1: mkcert (Самый простой - РЕКОМЕНДУЕТСЯ)

### Установка mkcert

**macOS:**
```bash
brew install mkcert
brew install nss # для Firefox
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/

# Arch Linux
sudo pacman -S mkcert
```

**Windows:**
```powershell
# Через Chocolatey
choco install mkcert

# Или через Scoop
scoop install mkcert
```

### Генерация сертификатов

```bash
# Установить локальный CA
mkcert -install

# Создать папку для сертификатов
mkdir -p cert

# Сгенерировать сертификаты для localhost
mkcert -key-file cert/localhost-key.pem -cert-file cert/localhost.pem localhost 127.0.0.1 ::1

echo "✅ Сертификаты созданы!"
```

### Обновить vite.config.ts

Используй конфиг с HTTPS (артефакт "vite.config.ts - С HTTPS").

### Запустить

```bash
npm run dev
```

Теперь открывай: **https://localhost:3000** ✅

---

## Способ 2: Vite plugin (Автоматический)

### Установка

```bash
npm install -D @vitejs/plugin-basic-ssl
```

### Обновить vite.config.ts

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    vue(),
    basicSsl(), // Автоматически создаст self-signed сертификат
    // ... остальные плагины
  ],
  server: {
    https: true, // Включить HTTPS
  }
});
```

```bash
npm run dev
```

Откроется: **https://localhost:5173** ✅

**Минус:** Браузер будет показывать предупреждение (нужно нажать "Продолжить").

---

## Способ 3: ngrok (Для тестирования на реальных устройствах)

Если нужен доступ с телефона или тест на настоящем домене:

### Установка ngrok

1. Регистрация: https://ngrok.com/
2. Скачай: https://ngrok.com/download
3. Авторизация:
```bash
ngrok config add-authtoken YOUR_TOKEN
```

### Запуск

```bash
# Запусти Vite
npm run dev

# В другом терминале
ngrok http 3000
```

Получишь URL типа: **https://abc123.ngrok.io** ✅

Обнови `.env`:
```env
VITE_APP_URL=https://abc123.ngrok.io
```

Теперь можешь открыть на любом устройстве через HTTPS!

---

## Способ 4: localhost (без HTTPS)

**WebAuthn работает на `http://localhost` БЕЗ HTTPS!**

Просто убедись, что используешь именно `localhost`, а не `127.0.0.1` или IP:

### vite.config.ts

```typescript
server: {
  host: 'localhost', // НЕ '0.0.0.0' или true
  port: 3000,
}
```

```bash
npm run dev
```

Открывай: **http://localhost:3000** ✅

**Важно:** Набирай именно `localhost`, а не `127.0.0.1`!

---

## Способ 5: Cloudflare Tunnel (Бесплатный HTTPS)

### Установка cloudflared

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**Windows:**
```powershell
winget install Cloudflare.cloudflared
```

### Запуск

```bash
# Запусти Vite
npm run dev

# В другом терминале
cloudflared tunnel --url http://localhost:3000
```

Получишь HTTPS URL: **https://random-name.trycloudflare.com** ✅

---

## Сравнение способов

| Способ | Сложность | HTTPS | Работает с телефона | Рекомендация |
|--------|-----------|-------|---------------------|--------------|
| **mkcert** | ⭐⭐ | ✅ Валидный | ❌ Только localhost | 🏆 Лучший для dev |
| **@vitejs/plugin-basic-ssl** | ⭐ | ⚠️ Self-signed | ❌ | ✅ Быстрый старт |
| **ngrok** | ⭐⭐ | ✅ Валидный | ✅ | ✅ Тестирование на устройствах |
| **localhost (HTTP)** | ⭐ | ❌ | ❌ | ✅ Самый простой |
| **Cloudflare Tunnel** | ⭐⭐ | ✅ Валидный | ✅ | ✅ Бесплатная альтернатива ngrok |

---

## Проверка WebAuthn

После настройки HTTPS, проверь в консоли браузера:

```javascript
if (window.PublicKeyCredential) {
  console.log('✅ WebAuthn supported');
  
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    .then(available => {
      console.log('Platform authenticator:', available ? '✅ Available' : '❌ Not available');
    });
} else {
  console.log('❌ WebAuthn NOT supported');
}
```

---

## Рекомендация

**Для локальной разработки:**

1. Если **только на своём компьютере** → используй `localhost` (HTTP) - **самый простой**
2. Если нужно **валидный HTTPS** → используй **mkcert** - **самый правильный**
3. Если нужно **тестировать на телефоне** → используй **ngrok** или **Cloudflare Tunnel**

**Для production:**
- Деплой на Vercel/Netlify/Cloudflare Pages → HTTPS автоматически ✅

---

## Быстрый старт (TL;DR)

### Вариант А: HTTP localhost (5 секунд)

```bash
# vite.config.ts → server.host = 'localhost'
npm run dev
# Открой: http://localhost:3000
```

### Вариант Б: HTTPS mkcert (2 минуты)

```bash
brew install mkcert  # или другой менеджер пакетов
mkcert -install
mkdir cert
mkcert -key-file cert/localhost-key.pem -cert-file cert/localhost.pem localhost
# Используй vite.config.ts с HTTPS
npm run dev
# Открой: https://localhost:3000
```

### Вариант В: ngrok (1 минута)

```bash
npm run dev
# В другом терминале:
ngrok http 3000
# Открой URL из вывода ngrok
```