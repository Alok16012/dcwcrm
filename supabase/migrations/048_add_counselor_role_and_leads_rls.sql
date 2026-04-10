-- Add 'counselor' as a valid role and update leads RLS
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'lead', 'backend', 'housekeeping', 'counselor'));

DROP POLICY IF EXISTS "Admin and backend can insert leads" ON leads;
CREATE POLICY "Admin, backend, lead, and counselor can insert leads"
  ON leads FOR INSERT
  WITH CHECK (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend', 'lead', 'counselor'))
  );
