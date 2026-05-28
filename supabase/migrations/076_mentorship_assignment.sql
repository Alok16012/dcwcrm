-- Mentorship Assignment
-- Admin tags a lead (telecaller) to a student; lead does the work from their portal

ALTER TABLE students ADD COLUMN IF NOT EXISTS mentor_telecaller_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_mentor ON students(mentor_telecaller_id);

-- Leads can read students assigned to them for mentorship
DROP POLICY IF EXISTS "lead_view_mentorship_students" ON students;
CREATE POLICY "lead_view_mentorship_students" ON students
  FOR SELECT USING (mentor_telecaller_id = auth.uid());

-- Leads can insert their own mentorship task submissions
DROP POLICY IF EXISTS "lead_insert_mentorship_tasks" ON student_mentorships;
CREATE POLICY "lead_insert_mentorship_tasks" ON student_mentorships
  FOR INSERT WITH CHECK (
    telecaller_id = auth.uid()
    AND EXISTS (SELECT 1 FROM students WHERE id = student_id AND mentor_telecaller_id = auth.uid())
  );

-- Leads can read their own submissions
DROP POLICY IF EXISTS "lead_view_own_mentorship_tasks" ON student_mentorships;
CREATE POLICY "lead_view_own_mentorship_tasks" ON student_mentorships
  FOR SELECT USING (telecaller_id = auth.uid());
