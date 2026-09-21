-- Alumni referral lead form.
--
-- Alumni fill a public form with the STUDENT's details plus who referred them.
-- The lead must land in CRM Leads with source = 'referral' and keep the
-- referrer, because the referrer is who gets the incentive.
--
-- Additive only. 'referral' is already a valid leads.source value, and
-- leads.referred_by_associate (uuid) is a different thing: it points at an
-- associate-portal login, whereas an alumnus has no account, so the referrer
-- is stored as plain name + phone.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS referred_by_phone text;

CREATE INDEX IF NOT EXISTS idx_leads_referred_by_phone
  ON leads (referred_by_phone) WHERE referred_by_phone IS NOT NULL;

-- Template form served at /f/alumni-referral. Editable from
-- Settings > Lead Forms. DO NOTHING so re-running never overwrites edits.
INSERT INTO lead_capture_forms (slug, title, subtitle, fields, success_message, source, is_active)
VALUES (
  'alumni-referral',
  'Alumni Referral Form',
  'Refer a student to Distance Courses Wala. Fill the student''s details and yours.',
  '[
    {"key":"full_name","label":"Student Name","type":"text","required":true,"placeholder":"Student''s full name"},
    {"key":"phone","label":"Student Mobile Number","type":"phone","required":true,"placeholder":"Student''s 10-digit mobile number"},
    {"key":"email","label":"Student Email","type":"email","required":false,"placeholder":"Student''s email"},
    {"key":"city","label":"Student City","type":"text","required":false,"placeholder":"Student''s city"},
    {"key":"course","label":"Course Interested In","type":"select","required":false,"options":["NIOS 10th","NIOS 12th","BA","B.Com","BBA","MBA","Other"]},
    {"key":"referred_by","label":"Referred By (Your Name)","type":"text","required":true,"placeholder":"Your full name"},
    {"key":"referred_by_phone","label":"Your Mobile Number","type":"phone","required":true,"placeholder":"Your 10-digit mobile number"}
  ]'::jsonb,
  'Thank you for the referral! Our team will contact the student shortly.',
  'referral',
  true
)
ON CONFLICT (slug) DO NOTHING;
