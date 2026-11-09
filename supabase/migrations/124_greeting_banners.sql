-- Festival greeting banners (Chhath Puja, Holi, Eid, …) on the dashboards.
--
-- Admin uploads an image (e.g. a Canva export), picks who sees it — staff,
-- students (portal) and/or associates (portal) — and the IST dates it runs.
-- The dashboards show the banner with an animation during those days and
-- drop it on their own afterwards. Images live in the public
-- 'student-documents' bucket under greetings/.

CREATE TABLE IF NOT EXISTS greeting_banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  message     text,
  image_url   text NOT NULL,
  -- 'staff' | 'student' | 'associate'
  audiences   text[] NOT NULL DEFAULT '{staff,student,associate}',
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  -- 'petals' | 'sparkles' | 'none'
  effect      text NOT NULL DEFAULT 'petals',
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

ALTER TABLE greeting_banners ENABLE ROW LEVEL SECURITY;

-- Everyone signed in (staff, students, associates) can read active banners.
DROP POLICY IF EXISTS greeting_banners_read ON greeting_banners;
CREATE POLICY greeting_banners_read ON greeting_banners FOR SELECT TO authenticated
  USING (is_active);

-- Admin/backend manage them.
DROP POLICY IF EXISTS greeting_banners_admin_all ON greeting_banners;
CREATE POLICY greeting_banners_admin_all ON greeting_banners FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE OR REPLACE FUNCTION set_greeting_banners_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_greeting_banners_updated_at ON greeting_banners;
CREATE TRIGGER trg_greeting_banners_updated_at BEFORE UPDATE ON greeting_banners
  FOR EACH ROW EXECUTE FUNCTION set_greeting_banners_updated_at();
