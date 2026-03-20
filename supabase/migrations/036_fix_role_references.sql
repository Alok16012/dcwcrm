-- Fix RLS policies in leads table to use 'lead' instead of 'telecaller'
DROP POLICY IF EXISTS "Telecaller and admin can insert leads" ON leads;
CREATE POLICY "Lead and admin can insert leads"
  ON leads FOR INSERT
  WITH CHECK (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'lead', 'backend'))
  );

DROP POLICY IF EXISTS "Admin and telecaller can update own leads" ON leads;
CREATE POLICY "Admin and lead can update own leads"
  ON leads FOR UPDATE
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = assigned_to
  );

DROP POLICY IF EXISTS "Telecaller can view own leads" ON leads;
CREATE POLICY "Lead can view own leads"
  ON leads FOR SELECT
  USING (
    auth.uid() = assigned_to OR auth.uid() = created_by
  );

-- Update students table RLS for consistency (removing old 'finance' role reference)
DROP POLICY IF EXISTS "Admin and backend can view all students" ON students;
CREATE POLICY "Admin, backend and lead can view students"
  ON students FOR SELECT
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend', 'lead'))
  );

-- Fix profiles check constraint (ensuring it's up to date)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'lead', 'backend'));
