-- Student document dispatch tracking
CREATE TABLE IF NOT EXISTS student_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  enrollment_number TEXT,
  associate_id UUID REFERENCES associates(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'marksheet',
  courier TEXT,
  tracking_number TEXT,
  dispatch_date DATE,
  expected_delivery DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','in_transit','delivered','returned','failed')),
  remarks TEXT,
  dispatched_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_dispatches_associate ON student_dispatches(associate_id);
CREATE INDEX IF NOT EXISTS idx_student_dispatches_status ON student_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_student_dispatches_created ON student_dispatches(created_at DESC);

ALTER TABLE student_dispatches ENABLE ROW LEVEL SECURITY;

-- Admin/backend/ops can do everything
CREATE POLICY "admin_full_dispatch" ON student_dispatches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend'))
  );

-- Associates can view their own dispatch records
CREATE POLICY "associate_view_own_dispatch" ON student_dispatches
  FOR SELECT USING (
    associate_id IN (SELECT id FROM associates WHERE user_id = auth.uid())
  );
