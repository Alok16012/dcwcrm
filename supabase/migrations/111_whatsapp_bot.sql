-- WhatsApp admission chatbot — conversation state and transcript.
--
-- The bot is a separate long-running service (whatsapp-bot/, on Railway). It
-- keeps each chat's position in the qualification flow here so a restart or
-- redeploy picks up mid-conversation, and it keeps every message so a
-- counsellor taking over can see exactly what the student was told.
--
-- Leads themselves still go into `leads` through the normal ingest path; these
-- tables are only the conversation.

CREATE TABLE IF NOT EXISTS wa_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The JID replies go to. May be a phone JID or a WhatsApp LID; the phone
  -- is resolved separately and can be null while it is unknown.
  chat_jid          text NOT NULL UNIQUE,
  phone             text,
  push_name         text,

  -- Engine state, round-tripped whole. The columns below are copies of the
  -- parts worth filtering on.
  state             jsonb NOT NULL DEFAULT '{}'::jsonb,
  flow              text CHECK (flow IN ('college', 'school')),
  status            text NOT NULL DEFAULT 'bot'
                      CHECK (status IN ('bot', 'handoff', 'opted_out')),
  lead_temperature  text,
  lead_id           uuid REFERENCES leads(id) ON DELETE SET NULL,

  -- A counsellor replied from the phone: the bot stays silent in this chat
  -- until this passes, so the two never talk over each other.
  human_until       timestamptz,

  last_inbound_at   timestamptz,
  last_outbound_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone    ON wa_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status   ON wa_conversations (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_lead     ON wa_conversations (lead_id);

CREATE TABLE IF NOT EXISTS wa_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  -- WhatsApp's own message id. Unique so a redelivered message is stored,
  -- and answered, once.
  wa_message_id     text UNIQUE,
  direction         text NOT NULL CHECK (direction IN ('in', 'out')),
  author            text NOT NULL CHECK (author IN ('student', 'bot', 'human')),
  body              text,
  media             text,
  ai_used           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON wa_messages (conversation_id, created_at);

-- Only the bot (service role) writes. Staff who handle leads can read.
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lead staff read conversations" ON wa_conversations;
CREATE POLICY "Lead staff read conversations" ON wa_conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND role IN ('admin', 'backend', 'lead', 'counselor')));

DROP POLICY IF EXISTS "Lead staff read messages" ON wa_messages;
CREATE POLICY "Lead staff read messages" ON wa_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND role IN ('admin', 'backend', 'lead', 'counselor')));

-- Admin may pause or resume the bot for a chat from the CRM.
DROP POLICY IF EXISTS "Admin updates conversations" ON wa_conversations;
CREATE POLICY "Admin updates conversations" ON wa_conversations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));
