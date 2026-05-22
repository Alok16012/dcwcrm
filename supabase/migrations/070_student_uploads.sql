-- Student-uploaded documents (student submits to admin)
CREATE TABLE IF NOT EXISTS student_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  remarks TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_uploads_student ON student_uploads(student_id, uploaded_at DESC);

ALTER TABLE student_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_student_uploads" ON student_uploads FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "student_own_uploads_select" ON student_uploads FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));

CREATE POLICY "student_own_uploads_insert" ON student_uploads FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));
