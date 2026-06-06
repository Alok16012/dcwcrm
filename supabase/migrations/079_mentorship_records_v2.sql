-- Mentorship Records v2
-- Add subject_name, amounts, screenshot to student_mentorships
-- Update task_type to include theory and assignment

ALTER TABLE student_mentorships
  DROP CONSTRAINT IF EXISTS student_mentorships_task_type_check;

ALTER TABLE student_mentorships
  ADD CONSTRAINT student_mentorships_task_type_check
  CHECK (task_type IN ('practical', 'assignment', 'theory', 'work_assignment', 'exam'));

ALTER TABLE student_mentorships
  ADD COLUMN IF NOT EXISTS subject_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS student_paid_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- Allow counselors to read their assigned students (same as leads)
DROP POLICY IF EXISTS "counselor_view_mentorship_students" ON students;
CREATE POLICY "counselor_view_mentorship_students" ON students
  FOR SELECT USING (mentor_telecaller_id = auth.uid());
