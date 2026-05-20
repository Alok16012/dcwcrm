ALTER TABLE student_dispatches
  ADD COLUMN IF NOT EXISTS student_phone TEXT,
  ADD COLUMN IF NOT EXISTS father_name TEXT;
