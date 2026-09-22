-- HRMS Phase 4 — payroll from attendance (requirement doc §9, §18–§21).
--
-- The salary slip has to show *why* it is what it is, so the attendance
-- breakdown that produced it is stored on the payroll row itself.

ALTER TABLE payroll
  ADD COLUMN IF NOT EXISTS working_days    NUMERIC,
  ADD COLUMN IF NOT EXISTS present_days    NUMERIC,
  ADD COLUMN IF NOT EXISTS late_days       NUMERIC,
  ADD COLUMN IF NOT EXISTS half_days       NUMERIC,
  ADD COLUMN IF NOT EXISTS absent_days     NUMERIC,
  ADD COLUMN IF NOT EXISTS cl_days         NUMERIC,
  ADD COLUMN IF NOT EXISTS sl_days         NUMERIC,
  ADD COLUMN IF NOT EXISTS lwp_days        NUMERIC,
  ADD COLUMN IF NOT EXISTS weekly_offs     NUMERIC,
  ADD COLUMN IF NOT EXISTS holidays_count  NUMERIC,
  ADD COLUMN IF NOT EXISTS per_day_salary  NUMERIC,
  ADD COLUMN IF NOT EXISTS late_deduction  NUMERIC DEFAULT 0,
  -- workflow (§20, §27)
  ADD COLUMN IF NOT EXISTS generated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_mode    TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS remarks         TEXT;

-- Manual additions / deductions, each with a reason (§19)
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id  UUID NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('addition','deduction')),
  label       TEXT NOT NULL,
  amount      NUMERIC NOT NULL CHECK (amount >= 0),
  reason      TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_payroll ON payroll_adjustments(payroll_id);

ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_adjustments_hr ON payroll_adjustments;
CREATE POLICY payroll_adjustments_hr ON payroll_adjustments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- A locked payroll row is read-only until an admin unlocks it (§20)
CREATE OR REPLACE FUNCTION payroll_block_locked_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked AND NEW.is_locked THEN
    RAISE EXCEPTION 'Payroll for % %/% is locked — unlock it before editing',
      OLD.employee_id, OLD.month, OLD.year;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_locked_guard ON payroll;
CREATE TRIGGER payroll_locked_guard
  BEFORE UPDATE ON payroll
  FOR EACH ROW EXECUTE FUNCTION payroll_block_locked_updates();
