-- Allow backend role to manage payroll (view, update status)
DROP POLICY IF EXISTS "Admins can manage payroll" ON payroll;
CREATE POLICY "Admin and backend can manage payroll"
  ON payroll FOR ALL
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
  );
