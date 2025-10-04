#!/bin/bash
# generate-certs.sh
# Генерация self-signed SSL сертификатов для localhost

echo "🔐 Генерация SSL сертификатов для localhost..."

# Создать папку для сертификатов
mkdir -p cert

# Генерация приватного ключа и сертификата
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout cert/localhost-key.pem \
  -out cert/localhost.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

echo "✅ Сертификаты созданы в папке cert/"
echo ""
echo "Для использования:"
echo "1. Установи сертификат в систему (опционально)"
echo "2. Запусти: npm run dev"
echo "3. Открой: https://localhost:3000"
echo "4. Браузер покажет предупреждение - нажми 'Продолжить' (это нормально для dev)"
echo ""
echo "⚠️ Не используй эти сертификаты в production!"