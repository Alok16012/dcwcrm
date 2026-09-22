-- Courier / post dispatches need to record the other side of the journey:
-- who it went to (outbound: "Rahul / NIOS Office") or came from (inbound),
-- and the address used. Shown on the WhatsApp message and the printed slip.

ALTER TABLE student_dispatches
  ADD COLUMN IF NOT EXISTS party_name    TEXT,
  ADD COLUMN IF NOT EXISTS party_address TEXT;
