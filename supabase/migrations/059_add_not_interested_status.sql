-- Add 'not_interested' to leads status CHECK constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check CHECK (status IN (
    'new',
    'contacted',
    'interested',
    'counselled',
    'document_received',
    'converted',
    'lost',
    'dnp',
    'switch_off',
    'not_reachable',
    'not_interested'
  ));
