-- ============================================================
-- Orivay — Contacts table (дополнение к основной схеме)
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id),
  CHECK (user_id <> contact_id)
);

CREATE INDEX idx_contacts_user    ON contacts(user_id);
CREATE INDEX idx_contacts_contact ON contacts(contact_id);

-- RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contacts: user can read own"
  ON contacts FOR SELECT
  USING (user_id = auth.uid() OR contact_id = auth.uid());

CREATE POLICY "Contacts: user can insert own"
  ON contacts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Contacts: user can delete own"
  ON contacts FOR DELETE
  USING (user_id = auth.uid());
