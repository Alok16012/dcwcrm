-- Allow 'pending' as a student status (awaiting admin approval after lead conversion)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students
  ADD CONSTRAINT students_status_check
  CHECK (status IN ('active', 'completed', 'dropped', 'on_hold', 'pending'));

-- Update trigger: converted leads create students with status='pending' (not active)
CREATE OR REPLACE FUNCTION handle_lead_conversion()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'converted' AND OLD.status != 'converted' THEN
    INSERT INTO students (
      lead_id, full_name, phone, email,
      course_id, sub_course_id, assigned_counsellor,
      total_fee, amount_paid, enrollment_date,
      mode, department_id, sub_section_id, status
    ) VALUES (
      NEW.id, NEW.full_name, NEW.phone, NEW.email,
      NEW.course_id, NEW.sub_course_id, NEW.assigned_to,
      NEW.total_fee, NEW.amount_paid, COALESCE(NEW.enrollment_date, CURRENT_DATE),
      NEW.mode, NEW.department_id, NEW.sub_section_id, 'pending'
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      mode          = EXCLUDED.mode,
      department_id = EXCLUDED.department_id,
      sub_section_id = EXCLUDED.sub_section_id,
      enrollment_date = EXCLUDED.enrollment_date,
      status = 'pending';

    NEW.converted_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
