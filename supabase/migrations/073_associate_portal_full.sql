-- Associate Resources table (admin uploads, associates download)
CREATE TABLE IF NOT EXISTS associate_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'other'
    CHECK (type IN ('brochure','fee_structure','admission_form','marketing','poster','reel','training','other')),
  url TEXT NOT NULL,
  file_size TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assoc_resources_type ON associate_resources(type, is_active);

-- Associate Support Tickets
CREATE TABLE IF NOT EXISTS associate_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associate_id UUID NOT NULL REFERENCES associates(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  admin_reply TEXT,
  replied_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assoc_tickets_assoc ON associate_support_tickets(associate_id);
CREATE INDEX IF NOT EXISTS idx_assoc_tickets_status ON associate_support_tickets(status);

-- RLS
ALTER TABLE associate_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE associate_support_tickets ENABLE ROW LEVEL SECURITY;

-- Resources: admins manage, associates read active
CREATE POLICY "admin_assoc_resources" ON associate_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "associate_read_resources" ON associate_resources FOR SELECT
  USING (
    is_active = true AND
    EXISTS (SELECT 1 FROM associates WHERE user_id = auth.uid())
  );

-- Tickets: associates manage own, admins see all
CREATE POLICY "associate_own_tickets" ON associate_support_tickets FOR ALL
  USING (associate_id IN (SELECT id FROM associates WHERE user_id = auth.uid()))
  WITH CHECK (associate_id IN (SELECT id FROM associates WHERE user_id = auth.uid()));

CREATE POLICY "admin_all_tickets" ON associate_support_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- Add referred_by_associate to students if not exists (for direct student lookup)
ALTER TABLE students ADD COLUMN IF NOT EXISTS referred_by_associate UUID REFERENCES associates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_assoc ON students(referred_by_associate) WHERE referred_by_associate IS NOT NULL;
