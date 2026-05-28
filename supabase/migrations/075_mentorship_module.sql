-- Mentorship Module
-- Track mentorship work assigned by admin to telecallers for specific students

CREATE TABLE IF NOT EXISTS student_mentorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  telecaller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_type     TEXT NOT NULL CHECK (task_type IN ('work_assignment', 'practical', 'exam')),
  description   TEXT,
  rating        NUMERIC(3,1) CHECK (rating >= 0 AND rating <= 10),

  -- Admin approval fields
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  salary_percentage NUMERIC(5,2),   -- % to add to telecaller salary (set by admin on approval)
  admin_remarks    TEXT,
  approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_student    ON student_mentorships(student_id);
CREATE INDEX IF NOT EXISTS idx_sm_telecaller ON student_mentorships(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_sm_status     ON student_mentorships(status);

ALTER TABLE student_mentorships ENABLE ROW LEVEL SECURITY;

-- Admin / backend: full access
CREATE POLICY "admin_mentorships_all" ON student_mentorships FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')
  ));

-- Telecallers: can read mentorships assigned to them
CREATE POLICY "telecaller_view_own" ON student_mentorships FOR SELECT
  USING (telecaller_id = auth.uid());
