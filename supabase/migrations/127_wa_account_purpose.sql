-- WhatsApp bot: what each number is for (Ads leads, Broadcasting, …), so the
-- team can tell the numbers apart on the WhatsApp Bot page.
-- 'admissions' | 'ads' | 'broadcast' | 'support' | 'other'

ALTER TABLE wa_accounts ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'admissions';
