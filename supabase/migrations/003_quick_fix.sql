-- БЫСТРОЕ ИСПРАВЛЕНИЕ: удаляем все политики и создаём простые
-- Выполни в Supabase → SQL Editor → Run

-- Шаг 1: Удалить ВСЕ политики на проблемных таблицах
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('chats','chat_participants','messages','profiles','contacts')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Шаг 2: Простые политики БЕЗ рекурсии
CREATE POLICY "p1" ON profiles        FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() = id);
CREATE POLICY "p2" ON chats           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "p3" ON chat_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "p4" ON messages        FOR ALL TO authenticated USING (true) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "p5" ON contacts        FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

SELECT 'Done! Policies fixed.' as result;
