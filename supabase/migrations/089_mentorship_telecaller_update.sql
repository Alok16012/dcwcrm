-- Telecallers could INSERT and SELECT their own mentorship cases but had no
-- UPDATE policy, so editing an existing case silently updated 0 rows and the
-- data never recorded. Allow mentors to update their own cases.

DROP POLICY IF EXISTS "telecaller_update_own" ON student_mentorships;
CREATE POLICY "telecaller_update_own" ON student_mentorships
  FOR UPDATE
  USING (telecaller_id = auth.uid())
  WITH CHECK (telecaller_id = auth.uid());
