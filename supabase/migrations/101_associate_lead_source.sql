-- Allow 'associate' as a lead source.
--
-- A lead pushed from the associate portal had no way to say where it came
-- from: the insert never set `source` at all, and `source` is NOT NULL with
-- no default, so every referral submission was rejected outright. Even once
-- that was fixed there was no value to store — a coordinator opening the
-- lead could not tell an associate referral from a walk-in.
--
-- The list below must repeat every value the constraint has ever gained,
-- not just the new one: 094 added 'meta_ads', 095 added 'ivr' and 097 added
-- 'google_ads', and there are live rows using them, so omitting any of them
-- makes this migration fail on existing data.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY[
    'website','walk_in','referral','whatsapp','phone',
    'excel_import','social_media','meta_ads','ivr','google_ads','associate','other'
  ])
);
