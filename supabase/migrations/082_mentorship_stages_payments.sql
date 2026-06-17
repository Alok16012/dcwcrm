-- Mentorship redesign: one DCW "case" per student with a 3-stage journey,
-- and installment payments recorded against the whole case (admin-approved).

-- 1) Stage journey on the case row (student_mentorships acts as the case)
ALTER TABLE student_mentorships
  ADD COLUMN IF NOT EXISTS stages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_stage TEXT;

-- 2) Installment payments ledger (per case), each verified/approved by admin
CREATE TABLE IF NOT EXISTS mentorship_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id  UUID NOT NULL REFERENCES student_mentorships(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  paid_on        DATE,
  screenshot_url TEXT,
  note           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  salary_percentage NUMERIC(5,2),
  admin_remarks     TEXT,
  approved_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_mentorship ON mentorship_payments(mentorship_id);
CREATE INDEX IF NOT EXISTS idx_mp_status     ON mentorship_payments(status);

ALTER TABLE mentorship_payments ENABLE ROW LEVEL SECURITY;

-- Admin / backend: full access
DROP POLICY IF EXISTS "mp_admin_all" ON mentorship_payments;
CREATE POLICY "mp_admin_all" ON mentorship_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

-- Mentor (telecaller/lead/counselor): manage payments for their own cases
DROP POLICY IF EXISTS "mp_mentor_insert" ON mentorship_payments;
CREATE POLICY "mp_mentor_insert" ON mentorship_payments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM student_mentorships m WHERE m.id = mentorship_id AND m.telecaller_id = auth.uid()
  ));
DROP POLICY IF EXISTS "mp_mentor_select" ON mentorship_payments;
CREATE POLICY "mp_mentor_select" ON mentorship_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_mentorships m WHERE m.id = mentorship_id AND m.telecaller_id = auth.uid()
  ));

-- Student: read payments for their own mentorship case
DROP POLICY IF EXISTS "mp_student_select" ON mentorship_payments;
CREATE POLICY "mp_student_select" ON mentorship_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_mentorships m
    JOIN students s ON s.id = m.student_id
    WHERE m.id = mentorship_id AND s.portal_user_id = auth.uid()
  ));
