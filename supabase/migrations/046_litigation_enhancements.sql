-- Litigation enhancements: record_type, refund, payment tracker, dropped students

-- Add record_type (litigation vs debt)
ALTER TABLE department_litigations ADD COLUMN IF NOT EXISTS record_type TEXT NOT NULL DEFAULT 'litigation';

-- Add amount_refunded
ALTER TABLE department_litigations ADD COLUMN IF NOT EXISTS amount_refunded NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Add student_id link (for dropped students auto-pulled in)
ALTER TABLE department_litigations ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

-- Add drop_reason to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS drop_reason TEXT;

-- Create litigation payments table (individual payment history)
CREATE TABLE IF NOT EXISTS litigation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  litigation_id UUID NOT NULL REFERENCES department_litigations(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT,
  receipt_no TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE litigation_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view litigation payments" ON litigation_payments;
DROP POLICY IF EXISTS "Admins can manage litigation payments" ON litigation_payments;

CREATE POLICY "Authenticated users can view litigation payments"
  ON litigation_payments FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage litigation payments"
  ON litigation_payments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
