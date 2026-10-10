-- WhatsApp bot flows admin builds in the CRM (Control Centre → Flows).
--
-- A flow is a start point — the words that trigger it, e.g. "Hi" — and a tree
-- of steps under it: send a message, ask a question whose answer picks the
-- branch, hand the chat to a counsellor, or carry on in the built-in
-- admission script. The tree lives in `root` as nested JSON, exactly as the
-- builder edits it; the bot re-reads active flows every minute.

CREATE TABLE IF NOT EXISTS wa_flows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  triggers          text[] NOT NULL DEFAULT '{}',
  -- exact: the whole message is a trigger ("hi"). contains: a trigger
  -- appears anywhere in it ("bosse ki fees kitni hai" → "fees").
  match_mode        text NOT NULL DEFAULT 'exact' CHECK (match_mode IN ('exact', 'contains')),
  -- Also run on a student's very first message, whatever it says.
  on_first_message  boolean NOT NULL DEFAULT false,
  root              jsonb,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wa_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages bot flows" ON wa_flows;
CREATE POLICY "Admin manages bot flows" ON wa_flows FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));
