-- Ensure new fields exist and are active in lead_form_fields
INSERT INTO lead_form_fields (field_key, label, field_type, is_required, is_active, is_system, display_order)
VALUES 
  ('mode', 'Mode (Attending/Non-attending)', 'select', false, true, true, 100),
  ('department_id', 'Department', 'select', false, true, true, 110),
  ('sub_section_id', 'University/Board', 'select', false, true, true, 120),
  ('enrollment_date', 'Expected Enrollment Date', 'date', false, true, true, 130)
ON CONFLICT (field_key) DO UPDATE SET 
  is_active = true,
  is_system = true;
