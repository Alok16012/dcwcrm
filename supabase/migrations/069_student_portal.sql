-- Student Portal: credentials, portal data, and all supporting tables

-- 1. Add portal columns to students table
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_username TEXT,
  ADD COLUMN IF NOT EXISTS portal_temp_password TEXT,
  ADD COLUMN IF NOT EXISTS portal_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS university_name TEXT,
  ADD COLUMN IF NOT EXISTS board_name TEXT,
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
  ADD COLUMN IF NOT EXISTS guardian_relationship TEXT,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male','female','other')),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','in_review','verified','rejected')),
  ADD COLUMN IF NOT EXISTS exam_status TEXT NOT NULL DEFAULT 'not_scheduled'
    CHECK (exam_status IN ('not_scheduled','scheduled','completed','result_awaited','passed','failed')),
  ADD COLUMN IF NOT EXISTS result_status TEXT NOT NULL DEFAULT 'awaited'
    CHECK (result_status IN ('awaited','declared','passed','failed','re_appear')),
  ADD COLUMN IF NOT EXISTS admit_card_url TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_card_url TEXT,
  ADD COLUMN IF NOT EXISTS id_card_url TEXT,
  ADD COLUMN IF NOT EXISTS marksheet_url TEXT,
  ADD COLUMN IF NOT EXISTS certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS admission_progress INT NOT NULL DEFAULT 0 CHECK (admission_progress BETWEEN 0 AND 100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_portal_user ON students(portal_user_id) WHERE portal_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_portal_active ON students(portal_active);

-- 2. Student notifications (admin broadcasts to specific students or all)
CREATE TABLE IF NOT EXISTS student_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','alert')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_notif_student ON student_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notif_read ON student_notifications(student_id, is_read);

-- 3. Student announcements (visible to all students)
CREATE TABLE IF NOT EXISTS student_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general','exam','result','fee','urgent')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON student_announcements(is_active, created_at DESC);

-- 4. Student support tickets
CREATE TABLE IF NOT EXISTS student_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_reply TEXT,
  replied_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_student ON student_support_tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON student_support_tickets(status);

-- 5. Study materials
CREATE TABLE IF NOT EXISTS study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'pdf' CHECK (type IN ('ebook','pdf_notes','syllabus','recorded_class','live_class','other')),
  url TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  sub_course_id UUID REFERENCES sub_courses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materials_course ON study_materials(course_id, is_active);
CREATE INDEX IF NOT EXISTS idx_materials_type ON study_materials(type, is_active);

-- 6. Student FAQs
CREATE TABLE IF NOT EXISTS student_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. RLS Policies

ALTER TABLE student_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_faqs ENABLE ROW LEVEL SECURITY;

-- Admin/backend can do everything on all student tables
CREATE POLICY "admin_student_notif" ON student_notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "admin_announcements" ON student_announcements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "admin_tickets" ON student_support_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "admin_materials" ON study_materials FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

CREATE POLICY "admin_faqs" ON student_faqs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','backend')));

-- Students can see their own notifications
CREATE POLICY "student_own_notif" ON student_notifications FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));

CREATE POLICY "student_mark_notif_read" ON student_notifications FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));

-- Students can see active announcements
CREATE POLICY "student_view_announcements" ON student_announcements FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Students can see and create their own tickets
CREATE POLICY "student_own_tickets" ON student_support_tickets FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));

CREATE POLICY "student_create_tickets" ON student_support_tickets FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));

-- Students can see active study materials for their course
CREATE POLICY "student_view_materials" ON study_materials FOR SELECT
  USING (
    is_active = true AND (
      course_id IS NULL
      OR course_id IN (SELECT course_id FROM students WHERE portal_user_id = auth.uid() AND course_id IS NOT NULL)
    )
  );

-- Students can see active FAQs
CREATE POLICY "student_view_faqs" ON student_faqs FOR SELECT
  USING (is_active = true);

-- Students can read their own student record
CREATE POLICY "student_read_own" ON students FOR SELECT
  USING (portal_user_id = auth.uid());

-- Students can update their own profile photo and contact info
CREATE POLICY "student_update_own_profile" ON students FOR UPDATE
  USING (portal_user_id = auth.uid())
  WITH CHECK (portal_user_id = auth.uid());

-- Students can read their own payments
CREATE POLICY "student_own_payments" ON payments FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE portal_user_id = auth.uid()));

-- Students can read their own dispatches
CREATE POLICY "student_own_dispatches" ON student_dispatches FOR SELECT
  USING (
    enrollment_number IN (SELECT enrollment_number FROM students WHERE portal_user_id = auth.uid())
  );

-- Insert some default FAQs
INSERT INTO student_faqs (question, answer, category, sort_order) VALUES
  ('How do I check my admission status?', 'Go to "My Admission Status" section in the portal to see your complete admission progress including verification, exam, and result status.', 'admission', 1),
  ('How can I download my admit card?', 'Once your admit card is issued, it will appear in the "My Admission Status" section under "Documents". You can download it from there.', 'exam', 2),
  ('Where can I see my payment history?', 'Go to "Accounts" section to view your complete payment history, pending dues, and download receipts.', 'payment', 3),
  ('How do I raise a support ticket?', 'Go to "Help & Support" section and click "Raise a Ticket". Our team will respond within 24-48 hours.', 'support', 4),
  ('How do I update my contact information?', 'Go to "Profile" section and click on "Contact Information" to update your phone number, email, or address.', 'profile', 5)
ON CONFLICT DO NOTHING;
