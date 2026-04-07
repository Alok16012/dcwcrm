-- Add guardian phone and relationship fields to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relationship TEXT;
