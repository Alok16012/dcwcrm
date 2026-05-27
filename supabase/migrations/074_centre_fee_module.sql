-- Centre Fee Module
-- Tracks actual payments made to boards/universities (separate from student fees)

CREATE TABLE IF NOT EXISTS centre_fee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE UNIQUE,

  -- Editable fee section
  centre_fee         NUMERIC(12,2),          -- total amount payable to board/university
  amount_paid        NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('paid','partial','pending')),

  -- Last payment details (for quick display)
  last_payment_date  DATE,
  payment_mode       TEXT CHECK (payment_mode IN ('cash','upi','bank_transfer','cheque','demand_draft','other')),
  transaction_id     TEXT,
  remarks            TEXT,

  -- Paid To details
  paid_to_board_name   TEXT,   -- board or university name paid to
  paid_to_person_name  TEXT,   -- individual person name (if applicable)
  account_holder_name  TEXT,
  bank_name            TEXT,
  upi_id               TEXT,
  account_number       TEXT,
  payment_contact      TEXT,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfr_student    ON centre_fee_records(student_id);
CREATE INDEX IF NOT EXISTS idx_cfr_status     ON centre_fee_records(payment_status);

-- Payment history (each individual payment transaction)
CREATE TABLE IF NOT EXISTS centre_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    UUID NOT NULL REFERENCES centre_fee_records(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT CHECK (payment_mode IN ('cash','upi','bank_transfer','cheque','demand_draft','other')),
  transaction_id TEXT,
  paid_to      TEXT,
  remarks      TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfp_record ON centre_fee_payments(record_id);

-- RLS
ALTER TABLE centre_fee_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE centre_fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_centre_fee_records" ON centre_fee_records FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "admin_centre_fee_payments" ON centre_fee_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- Trigger: auto-update amount_paid and status when a payment is added
CREATE OR REPLACE FUNCTION update_centre_fee_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC;
  total_fee  NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM centre_fee_payments WHERE record_id = NEW.record_id;

  SELECT COALESCE(centre_fee, 0) INTO total_fee
  FROM centre_fee_records WHERE id = NEW.record_id;

  UPDATE centre_fee_records SET
    amount_paid    = total_paid,
    payment_status = CASE
      WHEN total_paid <= 0           THEN 'pending'
      WHEN total_paid >= total_fee   THEN 'paid'
      ELSE                                'partial'
    END,
    last_payment_date = NEW.payment_date,
    payment_mode      = NEW.payment_mode,
    transaction_id    = NEW.transaction_id,
    updated_at        = now()
  WHERE id = NEW.record_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_centre_fee_payment ON centre_fee_payments;
CREATE TRIGGER trg_centre_fee_payment
  AFTER INSERT ON centre_fee_payments
  FOR EACH ROW EXECUTE FUNCTION update_centre_fee_on_payment();
