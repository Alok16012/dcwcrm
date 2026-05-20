-- GPS coordinates for punch in/out
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS punch_in_lat  NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS punch_in_lng  NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS punch_out_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS punch_out_lng NUMERIC(10, 7);

-- Allow employees to insert/update their own attendance row
CREATE POLICY "Employees can upsert own attendance"
  ON attendance FOR ALL
  USING (
    EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND profile_id = auth.uid())
  );
