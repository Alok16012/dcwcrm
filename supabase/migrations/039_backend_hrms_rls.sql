-- Allow backend to view and manage employees
DROP POLICY IF EXISTS "Admins can manage employees" ON employees;
CREATE POLICY "Admin can manage employees"
  ON employees FOR ALL
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Backend can view employees"
  ON employees FOR SELECT
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'backend')
  );

-- Allow backend to manage attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage attendance" ON attendance;
CREATE POLICY "Admin and backend can manage attendance"
  ON attendance FOR ALL
  USING (
    exists (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
  );

CREATE POLICY "Employees can view own attendance"
  ON attendance FOR SELECT
  USING (
    exists (SELECT 1 FROM employees WHERE id = employee_id AND profile_id = auth.uid())
  );
