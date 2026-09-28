-- WhatsApp bot control centre: settings, a knowledge base, and outreach.
--
-- Until now the bot was steered only by Railway environment variables, so
-- pausing it or turning AI on meant a redeploy. These tables let admin do it
-- from the CRM; the bot re-reads them every minute.

-- ------------------------------------------------------------ settings ---
CREATE TABLE IF NOT EXISTS wa_bot_settings (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),  -- one row
  -- Connected and recording, but silent in every chat.
  paused                boolean NOT NULL DEFAULT false,
  -- AI fallback on/off. Still needs GEMINI_API_KEY on the bot to do anything.
  ai_enabled            boolean NOT NULL DEFAULT true,

  -- Outreach: messaging existing leads first. Kept slow on purpose — an
  -- unofficial WhatsApp client that sends in bulk gets its number banned.
  outreach_enabled      boolean NOT NULL DEFAULT false,
  outreach_daily_limit  integer NOT NULL DEFAULT 30 CHECK (outreach_daily_limit BETWEEN 0 AND 200),
  outreach_start_hour   integer NOT NULL DEFAULT 10 CHECK (outreach_start_hour BETWEEN 0 AND 23),
  outreach_end_hour     integer NOT NULL DEFAULT 19 CHECK (outreach_end_hour BETWEEN 1 AND 24),
  outreach_min_gap_sec  integer NOT NULL DEFAULT 120 CHECK (outreach_min_gap_sec >= 30),
  outreach_max_gap_sec  integer NOT NULL DEFAULT 420 CHECK (outreach_max_gap_sec >= 30),
  -- Several wordings, picked at random per message. {name} is replaced.
  outreach_templates    text[] NOT NULL DEFAULT ARRAY[
    'Namaste {name} 🙏 DCW (Distance Courses Wala) se. Aapne pehle admission ke baare me enquiry ki thi — kya abhi bhi aapko guidance chahiye? Reply karein, hum help karenge.',
    'Hi {name}, DCW se baat kar rahe hain. Aapki pichhli enquiry ke baare me follow-up — 10th/12th ya graduation, kis course me admission dekh rahe hain?',
    'Hello {name} 👋 Distance Courses Wala se. Kya aapka admission ho gaya ya abhi bhi options dekh rahe hain? Batayein, counselor aapki help karega.'
  ],

  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO wa_bot_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------- knowledge ---
-- What admin teaches the bot. An entry with keywords is answered directly
-- when a student's message contains one (no AI needed); every active entry
-- is also handed to the AI as facts it may use.
CREATE TABLE IF NOT EXISTS wa_knowledge (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  keywords    text[] NOT NULL DEFAULT '{}',
  flow        text NOT NULL DEFAULT 'any' CHECK (flow IN ('any', 'college', 'school')),
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------ outreach ---
CREATE TABLE IF NOT EXISTS wa_outreach (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  phone       text NOT NULL,             -- 10 digits
  name        text,
  campaign    text,
  status      text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'replied', 'failed', 'skipped')),
  message     text,
  error       text,
  queued_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  queued_at   timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  replied_at  timestamptz
);

-- A number can wait in the queue only once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_outreach_queued ON wa_outreach (phone) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_wa_outreach_status ON wa_outreach (status, queued_at);
CREATE INDEX IF NOT EXISTS idx_wa_outreach_sent   ON wa_outreach (sent_at);

-- ---------------------------------------------------------------- RLS ---
ALTER TABLE wa_bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_knowledge    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_outreach     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages bot settings" ON wa_bot_settings;
CREATE POLICY "Admin manages bot settings" ON wa_bot_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

DROP POLICY IF EXISTS "Admin manages bot knowledge" ON wa_knowledge;
CREATE POLICY "Admin manages bot knowledge" ON wa_knowledge FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

DROP POLICY IF EXISTS "Admin manages outreach" ON wa_outreach;
CREATE POLICY "Admin manages outreach" ON wa_outreach FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

-- The chats page is management-only now (counsellors see their bot leads in
-- Leads), so the transcript follows.
DROP POLICY IF EXISTS "Lead staff read conversations" ON wa_conversations;
DROP POLICY IF EXISTS "Admin reads conversations" ON wa_conversations;
CREATE POLICY "Admin reads conversations" ON wa_conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

DROP POLICY IF EXISTS "Lead staff read messages" ON wa_messages;
DROP POLICY IF EXISTS "Admin reads messages" ON wa_messages;
CREATE POLICY "Admin reads messages" ON wa_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));
