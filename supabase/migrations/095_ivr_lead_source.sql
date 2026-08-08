-- Leads that arrive from the DCW-IVR calling system.
--
-- The IVR app (separate Supabase project) posts every inbound call to
-- /api/leads/ivr. The caller becomes a lead with source = 'ivr', assigned to
-- the CRM counsellor whose name matches the IVR agent who took the call
-- (Aditi, Purnima, ...). Call details (agent, status, duration, recording)
-- live in leads.metadata so no extra table is needed.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY[
    'website','walk_in','referral','whatsapp','phone',
    'excel_import','social_media','meta_ads','ivr','other'
  ])
);

-- A repeat caller must update the existing lead instead of creating a new one.
-- Numbers are stored in every format the team has ever pasted in ('9812345670',
-- '+919812345670', '+91 98123 45670', '0981...'), so matching on the raw text
-- would miss and duplicate the lead. Keep the comparable core — the last 10
-- digits — as a generated column the ingest webhook can look up exactly.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_last10 text
  GENERATED ALWAYS AS (right(regexp_replace(phone, '\D', '', 'g'), 10)) STORED;

CREATE INDEX IF NOT EXISTS idx_leads_phone_last10 ON leads (phone_last10);
