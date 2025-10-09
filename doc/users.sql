-- 1️⃣ Создание таблицы users
CREATE TABLE IF NOT EXISTS "public"."users" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT,
  "display_name" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  "active" BOOLEAN DEFAULT true,
  "last_seen_date" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_email ON users(email);

-- 2️⃣ Создание первого SuperAdmin
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Создаём пользователя в auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
  'delta46692@gmail.com', -- 👈 ИЗМЕНИ НА СВОЙ EMAIL
  crypt('P@ssw0rd123', gen_salt('bf')), -- хеш пароля
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Добавляем в таблицу users
  INSERT INTO "public"."users" (
    "user_id",
    "email",
    "phone",
    "display_name",
    "role",
    "active"
  ) VALUES (
    new_user_id,
  'delta46692@gmail.com',
  '+491631291530', -- опциональный телефон
    'System Administrator',
    'admin',
    true
  );
  
  RAISE NOTICE 'SuperAdmin created successfully with ID: %', new_user_id;
END $$;

-- 3️⃣ Row Level Security
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

-- Admins видят всех
CREATE POLICY "Admins see all users" ON "public"."users"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."users" u
      WHERE u.user_id = auth.uid() AND u.role = 'admin'
    )
  );

-- Admins могут изменять всех
CREATE POLICY "Admins modify all users" ON "public"."users"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "public"."users" u
      WHERE u.user_id = auth.uid() AND u.role = 'admin'
    )
  );