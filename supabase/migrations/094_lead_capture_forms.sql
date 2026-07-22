-- Public lead-capture forms (for Meta/Facebook ads landing pages).
-- Admin builds multiple forms; anyone can fill them at /f/{slug} without login.

-- 1. Allow 'meta_ads' as a lead source so ad leads are labelled distinctly.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY[
    'website','walk_in','referral','whatsapp','phone',
    'excel_import','social_media','meta_ads','other'
  ])
);

-- 2. Forms table
CREATE TABLE IF NOT EXISTS lead_capture_forms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  subtitle          text,
  -- fields: [{ key, label, type, required, options[], placeholder }]
  fields            jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_message   text DEFAULT 'Dhanyavaad! Hamari team jaldi aapse contact karegi.',
  source            text NOT NULL DEFAULT 'meta_ads',
  is_active         boolean NOT NULL DEFAULT true,
  submissions_count integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_capture_forms_slug ON lead_capture_forms(slug);

ALTER TABLE lead_capture_forms ENABLE ROW LEVEL SECURITY;

-- Public (anon) can read only active forms — needed to render the public page.
DROP POLICY IF EXISTS lcf_public_read ON lead_capture_forms;
CREATE POLICY lcf_public_read ON lead_capture_forms FOR SELECT
  USING (is_active = true);

-- Admin/backend can do everything.
DROP POLICY IF EXISTS lcf_admin_all ON lead_capture_forms;
CREATE POLICY lcf_admin_all ON lead_capture_forms FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_lead_capture_forms_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lcf_updated_at ON lead_capture_forms;
CREATE TRIGGER trg_lcf_updated_at BEFORE UPDATE ON lead_capture_forms
  FOR EACH ROW EXECUTE FUNCTION set_lead_capture_forms_updated_at();
