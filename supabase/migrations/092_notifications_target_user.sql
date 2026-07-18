-- Per-user targeted notifications (e.g. "new Meta lead assigned to you").
-- target_user_id null = broadcast / role-targeted (existing behaviour).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);
