-- Mentorship record: managed-by mode + mentor work status
-- managed_by: 'dcw' (DCW-managed, has payment) or 'self' (student self, no payment)
-- work_status: mentor-marked progress of the practical/assignment/theory work

ALTER TABLE student_mentorships
  ADD COLUMN IF NOT EXISTS managed_by  TEXT NOT NULL DEFAULT 'dcw'
    CHECK (managed_by IN ('dcw', 'self')),
  ADD COLUMN IF NOT EXISTS work_status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (work_status IN ('not_started', 'in_progress', 'completed'));

-- Students can read mentorship records for their own student row (portal view)
DROP POLICY IF EXISTS "student_view_own_mentorships" ON student_mentorships;
CREATE POLICY "student_view_own_mentorships" ON student_mentorships
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.portal_user_id = auth.uid())
  );
