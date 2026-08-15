-- Give Courses, Sessions, Litigation and Mentorship to specific backend
-- people — Puja Rani and Aditya Verma — without opening them to the whole
-- backend role. Rights in this CRM have always been role-wide, and the role
-- also contains Sobha Devi, who is explicitly not supposed to get these
-- modules. So the grant is a per-user list on the profile, not a role check:
-- an empty list means the role's own rights and nothing more.
--
-- Admin keeps implicit access everywhere and never needs an entry here.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS module_rights text[] NOT NULL DEFAULT '{}';

UPDATE profiles
SET module_rights = ARRAY['courses', 'sessions', 'litigation', 'mentorship']
WHERE role = 'backend' AND full_name IN ('Puja Rani', 'Aditya Verma');

-- Courses & sub-courses -------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage courses" ON courses;
CREATE POLICY "Admins can manage courses"
  ON courses FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role = 'admin' OR 'courses' = ANY(module_rights)))
  );

DROP POLICY IF EXISTS "Admins can manage sub_courses" ON sub_courses;
CREATE POLICY "Admins can manage sub_courses"
  ON sub_courses FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role = 'admin' OR 'courses' = ANY(module_rights)))
  );

-- Sessions ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage sessions" ON sessions;
CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role = 'admin' OR 'sessions' = ANY(module_rights)))
  );

-- Litigation ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage litigations" ON department_litigations;
CREATE POLICY "Admins can manage litigations"
  ON department_litigations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role = 'admin' OR 'litigation' = ANY(module_rights)))
  );

DROP POLICY IF EXISTS "Admins can manage litigation payments" ON litigation_payments;
CREATE POLICY "Admins can manage litigation payments"
  ON litigation_payments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
            AND (role = 'admin' OR 'litigation' = ANY(module_rights)))
  );

-- Mentorship ----------------------------------------------------------------------
-- These three were already open to the whole backend role (075/082/083) even
-- though no backend user could reach the screens. Tightened to the same
-- per-user grant, so the mentorship data really is limited to admin plus the
-- named people. Telecaller/lead/student policies on these tables are
-- untouched.
DROP POLICY IF EXISTS "admin_mentorships_all" ON student_mentorships;
CREATE POLICY "admin_mentorships_all" ON student_mentorships FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND (role = 'admin' OR 'mentorship' = ANY(module_rights))));

DROP POLICY IF EXISTS "mp_admin_all" ON mentorship_payments;
CREATE POLICY "mp_admin_all" ON mentorship_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND (role = 'admin' OR 'mentorship' = ANY(module_rights))));

DROP POLICY IF EXISTS "mi_admin_all" ON mentor_incentives;
CREATE POLICY "mi_admin_all" ON mentor_incentives FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND (role = 'admin' OR 'mentorship' = ANY(module_rights))));
