-- Ensure amount_paid exists and is active in lead_form_fields
INSERT INTO lead_form_fields (field_key, label, field_type, is_required, is_active, is_system, display_order)
VALUES 
  ('total_fee', 'Total Fee', 'number', false, true, true, 200),
  ('amount_paid', 'Amount Paid', 'number', false, true, true, 210)
ON CONFLICT (field_key) DO UPDATE SET 
  is_active = true,
  is_system = true;
