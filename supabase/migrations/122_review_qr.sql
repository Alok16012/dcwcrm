-- Review QR: a printable QR that sends customers to a Google review.
--
-- Scanning opens /r/{slug} (no login): the customer taps "5 Star Review",
-- picks a category, picks one of its ready-made reviews (or edits it), and the
-- page copies the text and opens the business's Google "write a review" box.
-- Google never lets anyone pre-fill the stars; the customer taps them there.
--
-- categories: [{ id, name, reviews: [text, …] }]

CREATE TABLE IF NOT EXISTS review_qr_pages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text UNIQUE NOT NULL,
  business_name      text NOT NULL,
  tagline            text,
  -- A Google review link (g.page/r/…/review, search.google.com/local/writereview?placeid=…)
  -- or a bare Place ID.
  google_review_url  text NOT NULL,
  categories         jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active          boolean NOT NULL DEFAULT true,
  scan_count         integer NOT NULL DEFAULT 0,
  copy_count         integer NOT NULL DEFAULT 0,
  google_open_count  integer NOT NULL DEFAULT 0,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE review_qr_pages ENABLE ROW LEVEL SECURITY;

-- The public page reads active pages only.
DROP POLICY IF EXISTS rqr_public_read ON review_qr_pages;
CREATE POLICY rqr_public_read ON review_qr_pages FOR SELECT
  USING (is_active = true);

-- Admin/backend manage them.
DROP POLICY IF EXISTS rqr_admin_all ON review_qr_pages;
CREATE POLICY rqr_admin_all ON review_qr_pages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE OR REPLACE FUNCTION set_review_qr_pages_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rqr_updated_at ON review_qr_pages;
CREATE TRIGGER trg_rqr_updated_at BEFORE UPDATE ON review_qr_pages
  FOR EACH ROW EXECUTE FUNCTION set_review_qr_pages_updated_at();

-- Counters bumped from the public page. Only these three counters, only on
-- active pages; nothing else is writable without a login.
CREATE OR REPLACE FUNCTION review_qr_track(p_slug text, p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event = 'scan' THEN
    UPDATE review_qr_pages SET scan_count = scan_count + 1 WHERE slug = p_slug AND is_active;
  ELSIF p_event = 'copy' THEN
    UPDATE review_qr_pages SET copy_count = copy_count + 1 WHERE slug = p_slug AND is_active;
  ELSIF p_event = 'google' THEN
    UPDATE review_qr_pages SET google_open_count = google_open_count + 1 WHERE slug = p_slug AND is_active;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION review_qr_track(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_qr_track(text, text) TO anon, authenticated;
