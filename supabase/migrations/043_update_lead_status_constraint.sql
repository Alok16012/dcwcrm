-- Migration 043: Update leads status CHECK constraint to include new status values
-- Old: 'new','contacted','interested','counselled','application_sent','converted','cold','lost'
-- New: adds 'document_received','dnp','switch_off','not_reachable' and removes 'application_sent','cold'

-- Step 1: Migrate existing rows with old status values
UPDATE leads SET status = 'document_received' WHERE status = 'application_sent';
UPDATE leads SET status = 'dnp' WHERE status = 'cold';

-- Step 2: Drop the old CHECK constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Step 3: Recreate with new valid status values
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
    'not_reachable'
  ));
