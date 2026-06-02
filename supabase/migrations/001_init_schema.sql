-- ============================================================
-- Orivay Messenger — ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ
-- Вставьте весь этот код в Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. Расширения ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. Таблица профилей (уже может существовать — пропускаем) ─
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  occupation  TEXT DEFAULT '',
  avatar_url  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Таблица чатов ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('personal_chat','channel','group')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Участники чатов ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_participants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_mode TEXT NOT NULL DEFAULT 'personal' CHECK (space_mode IN ('personal','work')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, profile_id)
);

-- ── 5. Сообщения ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Контакты ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- ── 7. Индексы для производительности ───────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_participants_profile ON chat_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat    ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat             ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created          ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_user             ON contacts(user_id);

-- ── 8. Row Level Security ────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "profiles_select"          ON profiles;
DROP POLICY IF EXISTS "profiles_insert"          ON profiles;
DROP POLICY IF EXISTS "profiles_update"          ON profiles;
DROP POLICY IF EXISTS "chats_select"             ON chats;
DROP POLICY IF EXISTS "chats_insert"             ON chats;
DROP POLICY IF EXISTS "participants_select"      ON chat_participants;
DROP POLICY IF EXISTS "participants_insert"      ON chat_participants;
DROP POLICY IF EXISTS "messages_select"          ON messages;
DROP POLICY IF EXISTS "messages_insert"          ON messages;
DROP POLICY IF EXISTS "messages_delete"          ON messages;
DROP POLICY IF EXISTS "contacts_select"          ON contacts;
DROP POLICY IF EXISTS "contacts_insert"          ON contacts;
DROP POLICY IF EXISTS "contacts_delete"          ON contacts;

-- PROFILES: любой авторизованный может читать, владелец — редактировать
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- CHATS: читать могут участники, создавать — любой авторизованный
CREATE POLICY "chats_select" ON chats
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_id = chats.id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "chats_insert" ON chats
  FOR INSERT TO authenticated WITH CHECK (true);

-- PARTICIPANTS: читать — сам пользователь или другой участник того же чата
CREATE POLICY "participants_select" ON chat_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "participants_insert" ON chat_participants
  FOR INSERT TO authenticated WITH CHECK (true);

-- MESSAGES: читать — участники чата, писать — участники чата
CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_id = messages.chat_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_id = messages.chat_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "messages_delete" ON messages
  FOR DELETE TO authenticated USING (true);

-- CONTACTS
CREATE POLICY "contacts_select" ON contacts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── 9. Триггер: автосоздание профиля при регистрации ────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username    TEXT;
  _display_name TEXT;
  _base        TEXT;
  _counter     INT := 0;
  _candidate   TEXT;
BEGIN
  -- Берём из metadata если есть
  _username     := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', '')));
  _display_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));

  -- Если username не передан — генерируем из email
  IF _username = '' THEN
    _base := LOWER(SPLIT_PART(NEW.email, '@', 1));
    _base := REGEXP_REPLACE(_base, '[^a-z0-9_]', '', 'g');
    IF _base = '' THEN _base := 'user'; END IF;
    _candidate := _base;
    WHILE EXISTS (SELECT 1 FROM profiles WHERE username = _candidate) LOOP
      _counter := _counter + 1;
      _candidate := _base || _counter::TEXT;
    END LOOP;
    _username := _candidate;
  END IF;

  -- Если display_name не передан — берём из email
  IF _display_name = '' THEN
    _display_name := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, _username, _display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Удаляем старый триггер если есть
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 10. Realtime ─────────────────────────────────────────────
-- Включаем realtime для нужных таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- ── Готово! ──────────────────────────────────────────────────
SELECT 'Schema created successfully!' as result;
