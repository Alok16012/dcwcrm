-- Add dispatch type to student_dispatches
ALTER TABLE student_dispatches
  ADD COLUMN IF NOT EXISTS dispatch_type TEXT NOT NULL DEFAULT 'outbound'
    CHECK (dispatch_type IN ('inbound', 'outbound'));

-- inbound = document received at DCW from university/institute
-- outbound = document dispatched from DCW to student/associate

CREATE INDEX IF NOT EXISTS idx_student_dispatches_type ON student_dispatches(dispatch_type);
