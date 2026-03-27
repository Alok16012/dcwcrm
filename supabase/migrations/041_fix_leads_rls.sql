-- Fix leads RLS: allow backend to update/transfer leads + ensure telecaller sees assigned leads

-- 1. UPDATE policy: add backend role (currently only admin + assigned user can update)
DROP POLICY IF EXISTS "Admin and telecaller can update own leads" ON leads;
DROP POLICY IF EXISTS "Admin and lead can update own leads" ON leads;
CREATE POLICY "Admin and backend can update leads"
  ON leads FOR UPDATE
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
    OR auth.uid() = assigned_to
  );

-- 2. SELECT: make sure lead role users can see their assigned leads
DROP POLICY IF EXISTS "Telecaller can view own leads" ON leads;
DROP POLICY IF EXISTS "Lead can view own leads" ON leads;
CREATE POLICY "Lead can view assigned leads"
  ON leads FOR SELECT
  USING (
    auth.uid() = assigned_to
  );

-- 3. DELETE: only admin/backend can delete leads
DROP POLICY IF EXISTS "Admin can delete leads" ON leads;
DROP POLICY IF EXISTS "Admin and backend can delete leads" ON leads;
CREATE POLICY "Admin and backend can delete leads"
  ON leads FOR DELETE
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
  );
