-- Allow a free-text "Custom" lead status.
-- The status value becomes 'custom'; the label the counselor typed is stored
-- in leads.custom_status and shown in place of the generic "Custom".

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS custom_status TEXT;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new', 'contacted', 'interested', 'counselled', 'document_received',
    'converted', 'lost', 'dnp', 'switch_off', 'not_reachable',
    'not_interested', 'custom'
  ));
