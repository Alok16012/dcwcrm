CREATE TABLE IF NOT EXISTS revenue_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Revenue Target',
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  lead_target INTEGER NOT NULL DEFAULT 0 CHECK (lead_target >= 0),
  conversion_target INTEGER NOT NULL DEFAULT 0 CHECK (conversion_target >= 0),
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily','weekly','monthly','quarterly','custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  bonus_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (bonus_percentage >= 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT revenue_targets_valid_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_revenue_targets_assignee ON revenue_targets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_revenue_targets_dates ON revenue_targets(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_revenue_targets_status ON revenue_targets(status);

CREATE OR REPLACE FUNCTION set_revenue_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS revenue_targets_updated_at ON revenue_targets;
CREATE TRIGGER revenue_targets_updated_at
  BEFORE UPDATE ON revenue_targets
  FOR EACH ROW EXECUTE FUNCTION set_revenue_targets_updated_at();

ALTER TABLE revenue_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage revenue targets" ON revenue_targets;
CREATE POLICY "Admins can manage revenue targets"
  ON revenue_targets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Counselors can view assigned revenue targets" ON revenue_targets;
CREATE POLICY "Counselors can view assigned revenue targets"
  ON revenue_targets FOR SELECT
  USING (assignee_id = auth.uid());

DROP POLICY IF EXISTS "Counselors can view own target payments" ON payments;
CREATE POLICY "Counselors can view own target payments"
  ON payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','backend','finance'))
    OR EXISTS (SELECT 1 FROM leads l WHERE l.id = payments.lead_id AND l.assigned_to = auth.uid())
    OR EXISTS (SELECT 1 FROM students s WHERE s.id = payments.student_id AND s.assigned_counsellor = auth.uid())
  );
