-- Allow backend role to manage attendance (was admin-only before)
DROP POLICY IF EXISTS "Admins can manage attendance" ON attendance;

CREATE POLICY "Admin and backend can manage attendance"
  ON attendance FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend'))
  );
