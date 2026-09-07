-- Simple fee-sheet library: admin/backend upload a PDF tagged with a flexible
-- 3-tier path (category -> sub_category -> level), associates/staff browse the
-- tiers and download the leaf PDF. e.g.
--   Open Schooling  ->  NIOS            ->  12th        -> pdf
--   Distance        ->  IGNOU University -> (no level)  -> pdf

CREATE TABLE IF NOT EXISTS fee_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,              -- tier 1 (e.g. Open Schooling / Distance)
  sub_category  TEXT NOT NULL,              -- tier 2 (e.g. NIOS / university name)
  level         TEXT,                       -- tier 3 (optional, e.g. 10th / 12th / UG)
  title         TEXT,                       -- optional display label
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  file_size     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_docs_category ON fee_documents(category);
CREATE INDEX IF NOT EXISTS idx_fee_docs_active   ON fee_documents(is_active);

ALTER TABLE fee_documents ENABLE ROW LEVEL SECURITY;

-- Admin / backend: full management
DROP POLICY IF EXISTS "fee_docs_admin_all" ON fee_documents;
CREATE POLICY "fee_docs_admin_all" ON fee_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

-- Any signed-in user (associate, lead, counselor, …) can read active fee sheets
DROP POLICY IF EXISTS "fee_docs_read_active" ON fee_documents;
CREATE POLICY "fee_docs_read_active" ON fee_documents FOR SELECT
  TO authenticated
  USING (is_active = true);
