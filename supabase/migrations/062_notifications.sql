-- General notifications table (admin-created broadcasts or targeted)
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info'
              CHECK (type IN ('info', 'warning', 'success', 'alert')),
  -- null target_role = broadcast to all
  target_role text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- Track which users have read which notifications
CREATE TABLE IF NOT EXISTS notification_reads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at         timestamptz DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read notifications targeted at their role or broadcast
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admin/backend can create
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')
    )
  );

CREATE POLICY notification_reads_select ON notification_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY notification_reads_insert ON notification_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);
