CREATE TABLE IF NOT EXISTS student_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_by_student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  referred_by_name TEXT NOT NULL,
  referred_by_enrollment TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  interested_in TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'admitted', 'rejected')),
  reward_given BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_student ON student_referrals(referred_by_student_id);

ALTER TABLE student_referrals ENABLE ROW LEVEL SECURITY;

-- Students can insert and view their own referrals
CREATE POLICY "student_insert_referral" ON student_referrals
  FOR INSERT WITH CHECK (
    referred_by_student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid())
  );

CREATE POLICY "student_view_own_referrals" ON student_referrals
  FOR SELECT USING (
    referred_by_student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid())
  );

-- Admin/backend full access
CREATE POLICY "admin_referrals_all" ON student_referrals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'backend')));
