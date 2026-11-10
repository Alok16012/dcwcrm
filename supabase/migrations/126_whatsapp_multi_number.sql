-- WhatsApp bot: several numbers at once.
--
-- Each linked WhatsApp number is a row in wa_accounts. The bot service runs
-- one worker per active row (whatsapp-bot/src/manager.mjs); each worker keeps
-- its own login, status and QR on its row, and sees only its own chats,
-- flows, admission script, settings and outreach queue. The AI knowledge base
-- stays shared by every number.
--
-- Everything that existed before belongs to "Number 1", whose id is fixed so
-- this migration can move the old rows onto it.

-- ------------------------------------------------------------ accounts ---
CREATE TABLE IF NOT EXISTS wa_accounts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label                text NOT NULL,
  -- Optional: the number to link by pairing code instead of a QR.
  phone                text,
  is_active            boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  -- Written by the bot worker (was wa_bot_status).
  status               text NOT NULL DEFAULT 'starting',
  connected_as         text,
  qr                   text,
  pairing_code         text,
  ai_provider          text,
  ai_used_today        integer,
  last_error           text,
  relink_requested_at  timestamptz,
  heartbeat_at         timestamptz,
  created_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wa_accounts (id, label, status, connected_as, sort_order)
SELECT '00000000-0000-0000-0000-000000000001', 'Number 1',
       COALESCE((SELECT status FROM wa_bot_status LIMIT 1), 'starting'),
       (SELECT connected_as FROM wa_bot_status LIMIT 1), 1
WHERE NOT EXISTS (SELECT 1 FROM wa_accounts WHERE id = '00000000-0000-0000-0000-000000000001');

ALTER TABLE wa_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages bot accounts" ON wa_accounts;
CREATE POLICY "Admin manages bot accounts" ON wa_accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

-- ------------------------------------------------------------ settings ---
-- One settings row per number (was a single row with id = true).
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES wa_accounts(id) ON DELETE CASCADE;
UPDATE wa_bot_settings SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
ALTER TABLE wa_bot_settings DROP CONSTRAINT IF EXISTS wa_bot_settings_pkey;
ALTER TABLE wa_bot_settings DROP CONSTRAINT IF EXISTS wa_bot_settings_id_check;
ALTER TABLE wa_bot_settings ALTER COLUMN account_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE wa_bot_settings ADD CONSTRAINT wa_bot_settings_pkey PRIMARY KEY (account_id);
EXCEPTION WHEN invalid_table_definition OR duplicate_object THEN NULL;
END $$;

-- A new number gets default settings straight away.
CREATE OR REPLACE FUNCTION wa_accounts_default_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO wa_bot_settings (account_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_wa_accounts_settings ON wa_accounts;
CREATE TRIGGER trg_wa_accounts_settings AFTER INSERT ON wa_accounts
  FOR EACH ROW EXECUTE FUNCTION wa_accounts_default_settings();

-- ------------------------------------------------------- conversations ---
-- The same student can chat with two of our numbers: one conversation each.
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES wa_accounts(id) ON DELETE CASCADE;
UPDATE wa_conversations SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
ALTER TABLE wa_conversations ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE wa_conversations ALTER COLUMN account_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_chat_jid_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_conv_account_jid ON wa_conversations (account_id, chat_jid);
CREATE INDEX IF NOT EXISTS idx_wa_conv_account ON wa_conversations (account_id, updated_at DESC);

-- --------------------------------------------------------------- flows ---
-- Trigger flows and the admission script are per number.
ALTER TABLE wa_flows ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES wa_accounts(id) ON DELETE CASCADE;
UPDATE wa_flows SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
ALTER TABLE wa_flows ALTER COLUMN account_id SET NOT NULL;
DROP INDEX IF EXISTS wa_flows_one_script;
CREATE UNIQUE INDEX IF NOT EXISTS wa_flows_one_script_per_account ON wa_flows (account_id) WHERE kind = 'script';
CREATE INDEX IF NOT EXISTS idx_wa_flows_account ON wa_flows (account_id, created_at);

-- ------------------------------------------------------------ outreach ---
-- Each number has its own queue and daily limit.
ALTER TABLE wa_outreach ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES wa_accounts(id) ON DELETE CASCADE;
UPDATE wa_outreach SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
ALTER TABLE wa_outreach ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE wa_outreach ALTER COLUMN account_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
DROP INDEX IF EXISTS uq_wa_outreach_queued;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_outreach_queued_account ON wa_outreach (account_id, phone) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_wa_outreach_account ON wa_outreach (account_id, status, queued_at);

-- ------------------------------------------------------------ messages ---
-- A message between two of our own numbers is recorded by both workers, so
-- the WhatsApp message id is unique per conversation, not across all of them.
ALTER TABLE wa_messages DROP CONSTRAINT IF EXISTS wa_messages_wa_message_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_messages_conv_msg ON wa_messages (conversation_id, wa_message_id);
