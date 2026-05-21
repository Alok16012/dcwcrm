-- Add missing reason and litigation_type columns to department_litigations
ALTER TABLE department_litigations
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS litigation_type TEXT;
