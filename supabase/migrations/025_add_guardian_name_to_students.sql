-- Add guardian_name to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name text;
