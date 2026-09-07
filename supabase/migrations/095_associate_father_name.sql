-- Associate application collects the father's NAME, not a second mobile number.
-- Add a proper father_name column. father_phone is kept for backward compat
-- (existing rows / any references) but is no longer captured by the form.

ALTER TABLE associates
  ADD COLUMN IF NOT EXISTS father_name TEXT;
