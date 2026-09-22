-- HRMS Phase 2 — leave and holidays (requirement doc §11–§14).
--
-- Balances are not stored: they are derived from the monthly CL/SL credit in
-- hrms_settings, the employee's joining date and the approved leave days, so a
-- corrected leave never leaves a stale balance row behind.

-- ------------------------------------------------------------- holidays ---
CREATE TABLE IF NOT EXISTS holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date) WHERE is_active;

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holidays_read ON holidays;
CREATE POLICY holidays_read ON holidays FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS holidays_write ON holidays;
CREATE POLICY holidays_write ON holidays FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- -------------------------------------------------------- leave requests ---
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS days             NUMERIC,
  ADD COLUMN IF NOT EXISTS attachment_url   TEXT,
  ADD COLUMN IF NOT EXISTS remarks          TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();

-- 'lwp' spelled out alongside the older 'unpaid'; both mean leave without pay
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('casual','sick','earned','unpaid','lwp','other'));

-- A request can be withdrawn before it is acted on (§12)
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled'));

CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_dates
  ON leave_requests(employee_id, from_date, to_date);

-- Admin/backend run HR, not just the 'admin' role the original policy allowed
DROP POLICY IF EXISTS "Admins can manage leave requests" ON leave_requests;
CREATE POLICY leave_requests_hr_all ON leave_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));
