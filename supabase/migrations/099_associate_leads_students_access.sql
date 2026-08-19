-- The associate portal has never been able to read its own data. leads and
-- students have had RLS enabled since early on, and every policy on both
-- tables names admin/backend/lead/counselor — 'associate' is not mentioned
-- once. An associate portal page querying either table gets zero rows back
-- (RLS filters silently, no error), which is why Students and Leads read
-- empty and the dashboard stats read zero, no matter how many students an
-- associate has actually brought in.
--
-- It runs deeper than reads: leads INSERT has the same gap, so an associate
-- submitting a referral via /associate/admissions has been rejected by RLS
-- on every attempt. That matches production — of all leads and students in
-- the database, not one carries a referred_by_associate value, even from an
-- associate who is active and approved.
--
-- Scoped through the associates table (id → user_id = auth.uid()), the same
-- ownership check the associate portal's own pages already do client-side
-- for everything else.

-- Read the leads they referred.
DROP POLICY IF EXISTS "associate_view_own_leads" ON leads;
CREATE POLICY "associate_view_own_leads" ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM associates a
      WHERE a.id = leads.referred_by_associate AND a.user_id = auth.uid()
    )
  );

-- Submit a referral — only ever attributed to themselves, never to another
-- associate's id.
DROP POLICY IF EXISTS "associate_insert_own_leads" ON leads;
CREATE POLICY "associate_insert_own_leads" ON leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM associates a
      WHERE a.id = leads.referred_by_associate AND a.user_id = auth.uid()
    )
  );

-- Read students referred directly, or converted from a lead they referred —
-- the same two paths AssociateStudentsPage already merges client-side.
DROP POLICY IF EXISTS "associate_view_own_students" ON students;
CREATE POLICY "associate_view_own_students" ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM associates a
      WHERE a.id = students.referred_by_associate AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      JOIN associates a ON a.id = l.referred_by_associate
      WHERE l.id = students.lead_id AND a.user_id = auth.uid()
    )
  );
