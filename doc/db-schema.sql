-- ============================================
-- Схема базы данных для WebAuthn аутентификации
-- ============================================

-- Создание extension для генерации UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ТАБЛИЦЫ
-- ============================================

-- Пользователи
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active BOOLEAN DEFAULT TRUE,
  last_seen_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Устройства (WebAuthn credentials)
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[],
  name TEXT,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE
);

-- Invite токены (QR)
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES public.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Временные challenges для WebAuthn
CREATE TABLE public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge TEXT NOT NULL UNIQUE,
  invite_id UUID REFERENCES public.invites(id),
  user_id UUID REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Сессии (опционально, можно использовать только JWT)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id UUID REFERENCES public.devices(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Логи административных действий
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ИНДЕКСЫ
-- ============================================

CREATE INDEX idx_devices_user_id ON public.devices(user_id);
CREATE INDEX idx_devices_credential_id ON public.devices(credential_id);
CREATE INDEX idx_devices_revoked ON public.devices(revoked) WHERE revoked = FALSE;

CREATE INDEX idx_invites_token_hash ON public.invites(token_hash);
CREATE INDEX idx_invites_expires_at ON public.invites(expires_at);
CREATE INDEX idx_invites_used ON public.invites(used) WHERE used = FALSE;

CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON public.sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);
CREATE INDEX idx_sessions_revoked ON public.sessions(revoked) WHERE revoked = FALSE;

CREATE INDEX idx_challenges_challenge ON public.webauthn_challenges(challenge);
CREATE INDEX idx_challenges_expires_at ON public.webauthn_challenges(expires_at);

CREATE INDEX idx_users_active ON public.users(active) WHERE active = TRUE;
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_last_seen_date ON public.users(last_seen_date);

CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs(admin_id);

-- ============================================
-- ТРИГГЕРЫ
-- ============================================

-- Обновление updated_at для users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Автоматическое удаление истекших challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webauthn_challenges
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Политики для users
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
    )
  );

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
    )
  );

-- Политики для devices
CREATE POLICY "Users can view their own devices"
  ON public.devices FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all devices"
  ON public.devices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
    )
  );

-- Политики для invites (только админы могут видеть)
CREATE POLICY "Admins can view invites"
  ON public.invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
    )
  );

-- Политики для sessions
CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all sessions"
  ON public.sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
    )
  );

-- Политики для admin_logs (только админы)
CREATE POLICY "Admins can view admin logs"
  ON public.admin_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
    )
  );

-- ============================================
-- ФУНКЦИИ УТИЛИТЫ
-- ============================================

-- Проверка, является ли пользователь админом
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_uuid AND role = 'admin' AND active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Обновление last_seen_date
CREATE OR REPLACE FUNCTION update_last_seen(user_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET last_seen_date = CURRENT_DATE
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Проверка валидности сессии
CREATE OR REPLACE FUNCTION is_session_valid(session_token_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token_hash = session_token_hash
      AND s.expires_at > NOW()
      AND s.revoked = FALSE
      AND u.active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- НАЧАЛЬНЫЕ ДАННЫЕ (опционально)
-- ============================================

-- Создание первого админа (замени на свои данные)
-- INSERT INTO public.users (display_name, role, active)
-- VALUES ('System Admin', 'admin', TRUE);

-- ============================================
-- КОММЕНТАРИИ
-- ============================================

COMMENT ON TABLE public.users IS 'Пользователи системы';
COMMENT ON TABLE public.devices IS 'WebAuthn устройства пользователей';
COMMENT ON TABLE public.invites IS 'Одноразовые invite токены для регистрации';
COMMENT ON TABLE public.webauthn_challenges IS 'Временные challenges для WebAuthn операций';
COMMENT ON TABLE public.sessions IS 'Активные сессии пользователей';
COMMENT ON TABLE public.admin_logs IS 'Логи административных действий';

COMMENT ON COLUMN public.devices.credential_id IS 'Base64URL encoded credential ID';
COMMENT ON COLUMN public.devices.public_key IS 'Base64URL encoded public key';
COMMENT ON COLUMN public.devices.counter IS 'Signature counter для защиты от replay атак';
COMMENT ON COLUMN public.invites.token_hash IS 'SHA-256 хеш invite токена';
COMMENT ON COLUMN public.users.last_seen_date IS 'Дата последнего входа (для проверки "раз в сутки")';