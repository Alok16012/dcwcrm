-- Exact incentive amount on a payment + a mentor incentive ledger
-- (credited to the mentor when a mentorship payment is approved)

ALTER TABLE mentorship_payments
  ADD COLUMN IF NOT EXISTS incentive_amount NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS mentor_incentives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_id  UUID REFERENCES mentorship_payments(id) ON DELETE SET NULL,
  student_id  UUID REFERENCES students(id) ON DELETE SET NULL,
  amount      NUMERIC(10,2) NOT NULL,
  reason      TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mi_mentor ON mentor_incentives(mentor_id);

ALTER TABLE mentor_incentives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mi_admin_all" ON mentor_incentives;
CREATE POLICY "mi_admin_all" ON mentor_incentives FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));

DROP POLICY IF EXISTS "mi_mentor_read" ON mentor_incentives;
CREATE POLICY "mi_mentor_read" ON mentor_incentives FOR SELECT
  USING (mentor_id = auth.uid());
