-- "Unlink / link another number" from the CRM's WhatsApp page.
--
-- Admin or backend stamps relink_requested_at; the bot polls it, logs the
-- current number out, clears the saved session and puts a fresh QR on the
-- page — no redeploy, no server log. The bot clears the stamp once it acts.

ALTER TABLE wa_bot_status ADD COLUMN IF NOT EXISTS relink_requested_at timestamptz;

DROP POLICY IF EXISTS "Admin requests bot relink" ON wa_bot_status;
CREATE POLICY "Admin requests bot relink" ON wa_bot_status FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));
