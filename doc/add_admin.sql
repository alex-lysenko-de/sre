-- bootstrap-admin.sql
-- Скрипт для создания первого администратора и invite токена

-- 1. Создать первого админа
INSERT INTO public.users (id, display_name, role, active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Фиксированный UUID для первого админа
  'System Administrator',
  'admin',
  TRUE,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Создать invite токен для первого админа
-- ВАЖНО: Замени 'your-secret-token-here' на свой случайный токен!
-- Сгенерируй токен: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

DO $$
DECLARE
  raw_token TEXT := 'ЗАМЕНИ_МЕНЯ_НА_СЛУЧАЙНЫЙ_ТОКЕН'; -- ← ЗАМЕНИ ЭТО!
  hashed_token TEXT;
BEGIN
  -- Хешируем токен (SHA-256)
  hashed_token := encode(digest(raw_token, 'sha256'), 'hex');
  
  -- Создаём invite
  INSERT INTO public.invites (
    token_hash,
    role,
    created_by,
    expires_at,
    used,
    created_at
  ) VALUES (
    hashed_token,
    'admin',
    '00000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '7 days', -- Действителен 7 дней
    FALSE,
    NOW()
  );
  
  -- Выводим информацию
  RAISE NOTICE '✅ Первый админ создан!';
  RAISE NOTICE '📱 QR-код URL: https://your-domain.com?invite=%', raw_token;
  RAISE NOTICE '⚠️  Сохрани этот URL! Он нужен для регистрации первого устройства.';
  RAISE NOTICE '⏰ Токен действителен до: %', NOW() + INTERVAL '7 days';
END $$;

-- 3. Проверка
SELECT 
  u.display_name,
  u.role,
  u.active,
  i.expires_at as invite_expires,
  i.used as invite_used
FROM public.users u
LEFT JOIN public.invites i ON i.created_by = u.id
WHERE u.id = '00000000-0000-0000-0000-000000000001';