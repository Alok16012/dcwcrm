-- Berojgar Bharat — staff, salary, and money collected from candidates
--
-- Three gaps this closes:
--   1. no way to create or manage BB staff
--   2. no salary for those staff
--   3. no record — and no receipt — for the fees candidates pay us
--
-- Berojgar Bharat earns from both sides: commission from the employer (105)
-- and fees from the job seeker (here). They are deliberately separate tables:
-- an employer invoice and a candidate receipt are different documents with
-- different rules, and conflating them makes both wrong.
--
-- BB staff get their own bb_employees / bb_attendance / bb_payroll rather than
-- sharing the DCW tables, for the same reason the rest of 105 is separate: one
-- business must never see the other's HR data.

-- ------------------------------------------------------------- staff ------
CREATE TABLE IF NOT EXISTS bb_employees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  employee_code     text NOT NULL UNIQUE,
  designation       text,
  department        text,
  joining_date      date,

  basic_salary      numeric(12,2) NOT NULL DEFAULT 0,
  hra               numeric(12,2) NOT NULL DEFAULT 0,
  allowances        numeric(12,2) NOT NULL DEFAULT 0,
  pf_deduction      numeric(12,2) NOT NULL DEFAULT 0,
  tds_deduction     numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions  numeric(12,2) NOT NULL DEFAULT 0,

  -- Recruitment pays on results, so the incentive is part of the salary
  -- structure rather than a monthly hand-entered number. A flat amount per
  -- placement, a cut of the commission it earned, or both.
  incentive_per_placement       numeric(12,2) NOT NULL DEFAULT 0,
  incentive_percent_of_commission numeric(6,3) NOT NULL DEFAULT 0,

  bank_account      text,
  bank_ifsc         text,
  bank_name         text,
  salary_cycle_start_day integer NOT NULL DEFAULT 1
                      CHECK (salary_cycle_start_day BETWEEN 1 AND 28),

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_employees_active ON bb_employees (is_active);

-- --------------------------------------------------------- attendance -----
CREATE TABLE IF NOT EXISTS bb_attendance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES bb_employees(id) ON DELETE CASCADE,
  date              date NOT NULL,
  status            text NOT NULL
                      CHECK (status IN ('present', 'absent', 'half_day', 'late', 'leave', 'holiday')),
  clock_in          time,
  clock_out         time,
  notes             text,
  marked_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_bb_attendance_month ON bb_attendance (date DESC);

-- ------------------------------------------------------------ payroll -----
CREATE TABLE IF NOT EXISTS bb_payroll (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES bb_employees(id) ON DELETE CASCADE,
  month             integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year              integer NOT NULL,

  basic             numeric(12,2) NOT NULL DEFAULT 0,
  hra               numeric(12,2) NOT NULL DEFAULT 0,
  allowances        numeric(12,2) NOT NULL DEFAULT 0,

  -- Attendance for the cycle, kept on the slip so a payslip can be explained
  -- months later without recomputing anything.
  present_days      numeric(5,1) NOT NULL DEFAULT 0,
  absent_days       numeric(5,1) NOT NULL DEFAULT 0,
  half_days         numeric(5,1) NOT NULL DEFAULT 0,
  leave_days        numeric(5,1) NOT NULL DEFAULT 0,
  lop_days          numeric(5,1) NOT NULL DEFAULT 0,
  leave_deduction   numeric(12,2) NOT NULL DEFAULT 0,

  -- What they placed in this cycle, and what that earned them.
  placement_count   integer NOT NULL DEFAULT 0,
  placement_incentive numeric(12,2) NOT NULL DEFAULT 0,

  gross             numeric(12,2) NOT NULL DEFAULT 0,
  pf                numeric(12,2) NOT NULL DEFAULT 0,
  tds               numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions  numeric(12,2) NOT NULL DEFAULT 0,
  net               numeric(12,2) NOT NULL DEFAULT 0,

  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'processed', 'paid')),
  payment_date      date,
  generated_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month, year)
);

-- ------------------------------------------------- candidate charges ------
-- What a job seeker owes us. Raised when they register, and again when they
-- are placed — the two are separate rows so each gets its own receipt.
CREATE TABLE IF NOT EXISTS bb_candidate_charges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid NOT NULL REFERENCES bb_candidates(id) ON DELETE CASCADE,
  application_id    uuid REFERENCES bb_applications(id) ON DELETE SET NULL,
  placement_id      uuid REFERENCES bb_placements(id) ON DELETE SET NULL,

  charge_type       text NOT NULL DEFAULT 'registration'
                      CHECK (charge_type IN ('registration', 'placement', 'other')),

  -- A charge is either a flat amount or a slice of the salary they landed.
  -- When it is a percentage, the salary it was computed from is stored too,
  -- so the figure can always be justified back to the candidate.
  basis             text NOT NULL DEFAULT 'fixed'
                      CHECK (basis IN ('fixed', 'percent_of_salary')),
  percent           numeric(6,3),
  salary_base       numeric(12,2),

  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  due_date          date,

  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'partially_paid', 'paid', 'waived', 'refunded')),
  amount_received   numeric(12,2) NOT NULL DEFAULT 0,

  notes             text,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_charges_candidate ON bb_candidate_charges (candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bb_charges_status    ON bb_candidate_charges (status, due_date);

-- Receipt numbers must be gapless-looking and never collide, even when two
-- counters hit save at the same instant — a sequence is the only safe source.
CREATE SEQUENCE IF NOT EXISTS bb_receipt_seq START 1;

CREATE OR REPLACE FUNCTION bb_next_receipt_no() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'BB/' ||
         to_char(timezone('Asia/Kolkata', now()), 'YYYY') || '/' ||
         lpad(nextval('bb_receipt_seq')::text, 5, '0');
$$;

-- ------------------------------------------------ candidate payments ------
-- Money actually received, one row per instalment. This table is the proof:
-- every row carries a receipt number, and rows are never edited away.
CREATE TABLE IF NOT EXISTS bb_candidate_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id         uuid NOT NULL REFERENCES bb_candidate_charges(id) ON DELETE CASCADE,
  candidate_id      uuid NOT NULL REFERENCES bb_candidates(id) ON DELETE CASCADE,

  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_mode      text NOT NULL DEFAULT 'cash'
                      CHECK (payment_mode IN ('cash', 'upi', 'card', 'neft', 'rtgs', 'cheque', 'other')),
  payment_date      date NOT NULL DEFAULT current_date,
  reference_no      text,

  -- Both are filled by the database on insert, so a receipt number is never
  -- chosen by a client and two people saving at once cannot collide.
  receipt_number    text NOT NULL UNIQUE DEFAULT bb_next_receipt_no(),
  -- Short, unguessable path segment for the shareable receipt link.
  receipt_slug      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),

  notes             text,
  recorded_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_payments_candidate ON bb_candidate_payments (candidate_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_bb_payments_date      ON bb_candidate_payments (payment_date DESC);

/**
 * Keep a charge's received total and status in step with its payments.
 * Doing it in a trigger means the two can never drift, whatever writes them.
 */
CREATE OR REPLACE FUNCTION bb_sync_charge_totals() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target uuid := COALESCE(NEW.charge_id, OLD.charge_id);
  paid numeric(12,2);
  due  numeric(12,2);
BEGIN
  SELECT COALESCE(sum(amount), 0) INTO paid
    FROM bb_candidate_payments WHERE charge_id = target;

  SELECT amount INTO due FROM bb_candidate_charges WHERE id = target;

  UPDATE bb_candidate_charges
     SET amount_received = paid,
         -- Rounding on a percentage-based charge can leave a rupee behind;
         -- within ₹1 counts as settled rather than stuck on "partially paid".
         status = CASE
                    WHEN status IN ('waived', 'refunded') THEN status
                    WHEN paid >= due - 1 THEN 'paid'
                    WHEN paid > 0        THEN 'partially_paid'
                    ELSE 'pending'
                  END,
         updated_at = now()
   WHERE id = target;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bb_candidate_payments_sync ON bb_candidate_payments;
CREATE TRIGGER bb_candidate_payments_sync
  AFTER INSERT OR UPDATE OR DELETE ON bb_candidate_payments
  FOR EACH ROW EXECUTE FUNCTION bb_sync_charge_totals();

-- --------------------------------------------------------------- RLS ------
ALTER TABLE bb_employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_payroll             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_candidate_charges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_candidate_payments  ENABLE ROW LEVEL SECURITY;

-- Staff records: managers manage, everyone may read their own.
DROP POLICY IF EXISTS "BB managers manage employees" ON bb_employees;
CREATE POLICY "BB managers manage employees" ON bb_employees FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());
DROP POLICY IF EXISTS "BB staff read own employee row" ON bb_employees;
CREATE POLICY "BB staff read own employee row" ON bb_employees FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "BB managers manage attendance" ON bb_attendance;
CREATE POLICY "BB managers manage attendance" ON bb_attendance FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());
DROP POLICY IF EXISTS "BB staff read own attendance" ON bb_attendance;
CREATE POLICY "BB staff read own attendance" ON bb_attendance FOR SELECT
  USING (EXISTS (SELECT 1 FROM bb_employees e WHERE e.id = employee_id AND e.profile_id = auth.uid()));

DROP POLICY IF EXISTS "BB managers manage payroll" ON bb_payroll;
CREATE POLICY "BB managers manage payroll" ON bb_payroll FOR ALL
  USING (is_bb_manager()) WITH CHECK (is_bb_manager());
DROP POLICY IF EXISTS "BB staff read own payroll" ON bb_payroll;
CREATE POLICY "BB staff read own payroll" ON bb_payroll FOR SELECT
  USING (EXISTS (SELECT 1 FROM bb_employees e WHERE e.id = employee_id AND e.profile_id = auth.uid()));

-- Candidate money: any BB staff member may take a payment and hand over a
-- receipt — that is the counter job — but only managers may waive or refund,
-- which is enforced in the app layer on top of these.
DROP POLICY IF EXISTS "BB staff candidate charges" ON bb_candidate_charges;
CREATE POLICY "BB staff candidate charges" ON bb_candidate_charges FOR ALL
  USING (is_bb_staff()) WITH CHECK (is_bb_staff());

DROP POLICY IF EXISTS "BB staff candidate payments" ON bb_candidate_payments;
CREATE POLICY "BB staff candidate payments" ON bb_candidate_payments FOR ALL
  USING (is_bb_staff()) WITH CHECK (is_bb_staff());

-- ------------------------------------------------------- updated_at -------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bb_employees', 'bb_payroll', 'bb_candidate_charges'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bb_touch_updated_at()',
      t || '_touch', t
    );
  END LOOP;
END $$;
