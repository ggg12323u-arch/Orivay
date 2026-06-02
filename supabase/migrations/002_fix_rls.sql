-- ============================================================
-- Orivay — ИСПРАВЛЕНИЕ RLS ПОЛИТИК (без рекурсии)
-- Вставьте в Supabase → SQL Editor → Run
-- ============================================================

-- ── Удаляем ВСЕ старые политики ─────────────────────────────

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

-- На случай если политики называются иначе — удаляем все разом
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','chats','chat_participants','messages','contacts')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── PROFILES ─────────────────────────────────────────────────
-- Любой авторизованный может читать все профили (нужно для поиска)
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Только сам пользователь может создать/изменить свой профиль
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ── CHATS ────────────────────────────────────────────────────
-- Любой авторизованный может читать и создавать чаты
-- (проверка участия делается в коде, не в RLS — избегаем рекурсию)
CREATE POLICY "chats_read_all" ON chats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chats_insert_any" ON chats
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── CHAT_PARTICIPANTS ─────────────────────────────────────────
-- Без рекурсии: просто разрешаем всем авторизованным
CREATE POLICY "participants_read_all" ON chat_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "participants_insert_any" ON chat_participants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "participants_delete_own" ON chat_participants
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- ── MESSAGES ─────────────────────────────────────────────────
-- Читать могут все авторизованные
CREATE POLICY "messages_read_all" ON messages
  FOR SELECT TO authenticated USING (true);

-- Писать может только отправитель от своего имени
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- Удалять может любой участник (hard delete)
CREATE POLICY "messages_delete_any" ON messages
  FOR DELETE TO authenticated USING (true);

-- ── CONTACTS ─────────────────────────────────────────────────
CREATE POLICY "contacts_read_own" ON contacts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "contacts_insert_own" ON contacts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_delete_own" ON contacts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Проверяем результат ──────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','chats','chat_participants','messages','contacts')
ORDER BY tablename, policyname;
