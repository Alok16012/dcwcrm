-- HRMS Phase 1 — configurable rules + a richer attendance verdict.
--
-- Everything the attendance engine decides with (reporting time, grace, late /
-- half-day / absent windows, working days, deductions) lives in one settings
-- row so nothing is hard-coded, per the DCW HRMS requirement doc §4 and §31.

CREATE TABLE IF NOT EXISTS hrms_settings (
  -- single-row table: the primary key can only ever be true
  id                     BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),

  -- Attendance (§2, §7, §31)
  working_days           INT     NOT NULL DEFAULT 26,
  weekly_off_day         SMALLINT NOT NULL DEFAULT 0,          -- 0 = Sunday
  office_start           TIME    NOT NULL DEFAULT '10:30',
  office_end             TIME    NOT NULL DEFAULT '18:00',
  grace_till             TIME    NOT NULL DEFAULT '10:45',     -- till here: on time
  late_till              TIME    NOT NULL DEFAULT '11:30',     -- till here: late
  half_day_till          TIME    NOT NULL DEFAULT '12:30',     -- till here: half day, after: absent
  early_leaving_grace_min INT    NOT NULL DEFAULT 0,           -- minutes before office_end that are ignored
  min_full_day_minutes   INT     NOT NULL DEFAULT 360,

  -- Leave (§11, §31) — used from Phase 2, stored here so settings stay in one place
  cl_per_month           NUMERIC NOT NULL DEFAULT 1,
  sl_per_month           NUMERIC NOT NULL DEFAULT 1,
  leave_carry_forward    BOOLEAN NOT NULL DEFAULT TRUE,
  max_carry_forward      NUMERIC,

  -- Payroll (§8, §9, §31)
  salary_divisor         INT     NOT NULL DEFAULT 26,
  half_day_factor        NUMERIC NOT NULL DEFAULT 0.5,
  late_deduction_amount  NUMERIC NOT NULL DEFAULT 0,           -- per late occurrence
  salary_advance_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  updated_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO hrms_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE hrms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hrms_settings_read ON hrms_settings;
CREATE POLICY hrms_settings_read ON hrms_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS hrms_settings_write ON hrms_settings;
CREATE POLICY hrms_settings_write ON hrms_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- ---------------------------------------------------------------- attendance ---
-- What the engine worked out, kept beside the punch times (§10, §17).
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS work_minutes  INT,
  ADD COLUMN IF NOT EXISTS late_minutes  INT,
  ADD COLUMN IF NOT EXISTS early_minutes INT,
  ADD COLUMN IF NOT EXISTS auto_status   TEXT,     -- engine verdict, before any manual override
  ADD COLUMN IF NOT EXISTS computed_at   TIMESTAMPTZ;

-- The statuses of §6. Old rows only ever used the first six, so widening is safe.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN (
    'present','absent','half_day','late','leave','holiday',
    'weekly_off','weekly_off_worked','holiday_worked','missing',
    'cl','sl','lwp'
  ));
