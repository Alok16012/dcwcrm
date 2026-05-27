ALTER TABLE student_notifications
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;
