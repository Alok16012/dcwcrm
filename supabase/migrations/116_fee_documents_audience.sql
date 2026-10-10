-- Fee PDFs are published to one audience: counsellors (counselor + lead
-- roles, /fee-documents) or associates (/associate/fees). NULL = legacy rows
-- uploaded before this column existed, still visible to everyone.

ALTER TABLE fee_documents
  ADD COLUMN IF NOT EXISTS audience TEXT
  CHECK (audience IN ('counselor', 'associate'));

CREATE INDEX IF NOT EXISTS idx_fee_docs_audience ON fee_documents(audience);

-- Non-admin readers only see active sheets published to their own role
DROP POLICY IF EXISTS "fee_docs_read_active" ON fee_documents;
CREATE POLICY "fee_docs_read_active" ON fee_documents FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      audience IS NULL
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND (
            (fee_documents.audience = 'associate' AND p.role = 'associate')
            OR (fee_documents.audience = 'counselor' AND p.role IN ('counselor', 'lead'))
          )
      )
    )
  );
