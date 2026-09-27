-- WhatsApp bot connection status, so the CRM can show it — and the QR code.
--
-- The bot runs on Railway. Until now the only place its QR code appeared was
-- the server log, as terminal block art nobody could reasonably scan. The bot
-- now writes its state here and the CRM's WhatsApp page renders it.
--
-- One row. The QR in it is sensitive for the ~20 seconds it is valid: scanning
-- it links *the scanner's* WhatsApp as the bot. So only admin and backend can
-- read this table.

CREATE TABLE IF NOT EXISTS wa_bot_status (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),  -- exactly one row
  status        text NOT NULL DEFAULT 'starting',
  connected_as  text,
  -- PNG data URL of the current QR, or null once linked.
  qr            text,
  -- Set when WA_PHONE_NUMBER is configured: link-by-code instead of QR.
  pairing_code  text,
  ai_provider   text,
  ai_used_today integer,
  last_error    text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wa_bot_status (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE wa_bot_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads bot status" ON wa_bot_status;
CREATE POLICY "Admin reads bot status" ON wa_bot_status FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));
