-- Add DELETE policies for leads
create policy "Admins can delete any lead"
  on leads for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Backend can delete any lead"
  on leads for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'backend')
  );

-- Note: We don't allow telecallers to delete leads usually, but if needed:
-- create policy "Telecallers can delete own leads"
--   on leads for delete
--   using (auth.uid() = assigned_to or auth.uid() = created_by);

-- Ensure students table has explicit delete policies if not already covered by 'ALL'
-- Existing policy in 007_students.sql:
-- create policy "Admin and backend can manage students" on students for all ...
-- This already covers DELETE.

-- Add DELETE policy for lead_activities just in case, though it has cascade delete from leads
create policy "Admins can delete activities"
  on lead_activities for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
