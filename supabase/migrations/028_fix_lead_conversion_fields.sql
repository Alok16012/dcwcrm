-- Add missing columns to leads table for department/sub-section
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sub_section_id uuid REFERENCES department_sub_sections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS enrollment_date date;

-- Update handle_lead_conversion trigger to include new fields
CREATE OR REPLACE FUNCTION handle_lead_conversion()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'converted' AND OLD.status != 'converted' THEN
    INSERT INTO students (
      lead_id, full_name, phone, email,
      course_id, sub_course_id, assigned_counsellor,
      total_fee, amount_paid, enrollment_date,
      mode, department_id, sub_section_id
    ) VALUES (
      NEW.id, NEW.full_name, NEW.phone, NEW.email,
      NEW.course_id, NEW.sub_course_id, NEW.assigned_to,
      NEW.total_fee, NEW.amount_paid, COALESCE(NEW.enrollment_date, CURRENT_DATE),
      NEW.mode, NEW.department_id, NEW.sub_section_id
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      mode = EXCLUDED.mode,
      department_id = EXCLUDED.department_id,
      sub_section_id = EXCLUDED.sub_section_id,
      enrollment_date = EXCLUDED.enrollment_date;
    
    NEW.converted_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
