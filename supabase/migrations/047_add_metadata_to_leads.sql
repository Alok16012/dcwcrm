-- Add metadata column to leads table to store extra information from external sources like Meta
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create an index for better performance on jsonb queries if needed later
CREATE INDEX IF NOT EXISTS idx_leads_metadata ON leads USING gin (metadata);
