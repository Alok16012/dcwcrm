-- Fix expenses RLS: replace 'finance' role (removed) with 'backend', add 'backend' to update policy
DROP POLICY IF EXISTS "Finance and admin can view all expenses" ON expenses;
CREATE POLICY "Admin and backend can view all expenses"
  ON expenses FOR SELECT
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
  );

DROP POLICY IF EXISTS "Finance and admin can update expenses" ON expenses;
CREATE POLICY "Admin and backend can update expenses"
  ON expenses FOR UPDATE
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
  );

-- Also allow all authenticated users to view their own submitted expenses
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (submitted_by = auth.uid());
