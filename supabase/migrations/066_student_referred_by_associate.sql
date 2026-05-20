ALTER TABLE students
  ADD COLUMN IF NOT EXISTS referred_by_associate UUID REFERENCES associates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_referred_by_associate ON students(referred_by_associate);
