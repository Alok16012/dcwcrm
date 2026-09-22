-- HRMS Phase 3 — regularization, one-off late permission and the audit trail
-- (requirement doc §15, §16, §29).

-- Employees can't edit biometric attendance; they raise a request instead (§15)
CREATE TABLE IF NOT EXISTS attendance_regularizations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date      DATE NOT NULL,
  punch_type     TEXT NOT NULL DEFAULT 'both' CHECK (punch_type IN ('in','out','both')),
  requested_in   TIME,
  requested_out  TIME,
  reason         TEXT NOT NULL,
  attachment_url TEXT,
  remarks        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','cancelled')),
  rejection_reason TEXT,
  applied_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regularization_emp_date
  ON attendance_regularizations(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_regularization_status
  ON attendance_regularizations(status) WHERE status = 'pending';

ALTER TABLE attendance_regularizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regularization_hr ON attendance_regularizations;
CREATE POLICY regularization_hr ON attendance_regularizations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

DROP POLICY IF EXISTS regularization_own ON attendance_regularizations;
CREATE POLICY regularization_own ON attendance_regularizations FOR ALL
  USING (EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM employees WHERE id = employee_id AND profile_id = auth.uid()));

-- A late permission for ONE date — never a standing grace period (§16)
CREATE TABLE IF NOT EXISTS special_late_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,
  allowed_till TIME NOT NULL,
  reason       TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

ALTER TABLE special_late_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS late_permission_read ON special_late_permissions;
CREATE POLICY late_permission_read ON special_late_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS late_permission_write ON special_late_permissions;
CREATE POLICY late_permission_write ON special_late_permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- Who changed what, when and why (§29)
CREATE TABLE IF NOT EXISTS hrms_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity      TEXT NOT NULL,           -- attendance | leave_request | regularization | payroll | employee | settings
  entity_id   TEXT,
  action      TEXT NOT NULL,           -- approved | rejected | updated | unlocked | deleted …
  old_value   JSONB,
  new_value   JSONB,
  reason      TEXT,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hrms_audit_entity ON hrms_audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_hrms_audit_created ON hrms_audit_logs(created_at DESC);

ALTER TABLE hrms_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hrms_audit_read ON hrms_audit_logs;
CREATE POLICY hrms_audit_read ON hrms_audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- Written server-side with the service role; no client inserts.
