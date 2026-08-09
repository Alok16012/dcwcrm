-- Allow 'google_ads' as a lead source.
--
-- The public forms at /f/* now take paid traffic from Google as well as
-- Meta, but every submission was being stored as 'meta_ads' — the value
-- was defaulted on the form and hardcoded in the API route. A Google lead
-- arriving in the CRM labelled "Meta Ads" makes it impossible to tell
-- which channel actually produced it, which is the only reason to run
-- the tracking at all.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY[
    'website','walk_in','referral','whatsapp','phone',
    'excel_import','social_media','meta_ads','google_ads','other'
  ])
);
