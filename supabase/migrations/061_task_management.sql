-- Task management table
CREATE TABLE IF NOT EXISTS tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text,
  urgency          text NOT NULL DEFAULT 'medium'
                   CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  -- assignee: stored as user_id (auth.users) + denormalized name for display
  assigned_to      uuid NOT NULL,           -- auth.users.id
  assigned_to_name text NOT NULL,
  -- optionally track if assignee is an associate (for associate portal filter)
  assigned_to_associate_id uuid REFERENCES associates(id) ON DELETE SET NULL,
  created_by       uuid NOT NULL,           -- auth.users.id
  created_by_name  text NOT NULL,
  due_date         date NOT NULL,
  reminder_date    date,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'in_progress', 'done')),
  rating           int  CHECK (rating BETWEEN 1 AND 5),
  completion_note  text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- RLS: any authenticated user can read tasks assigned to them or created by them
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);

CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);

CREATE POLICY tasks_delete ON tasks FOR DELETE
  USING (auth.uid() = created_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_tasks_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_tasks_updated_at();
