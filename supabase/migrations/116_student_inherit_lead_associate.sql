-- A student admitted through an associate must carry students.referred_by_associate:
-- the student portal hides every fee screen for them on that column alone.
--
-- Converting an associate's lead (handle_lead_conversion) didn't copy the
-- associate across, so such a student would still see fees. Copy it whenever a
-- student gets linked to a lead, and when an associate is set on an
-- already-converted lead. An associate set directly on the student always wins.

create or replace function public.student_inherit_lead_associate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by_associate is null and new.lead_id is not null then
    select l.referred_by_associate into new.referred_by_associate
    from leads l where l.id = new.lead_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_student_inherit_lead_associate on students;
create trigger trg_student_inherit_lead_associate
  -- Not on updates of referred_by_associate itself, so staff can still clear it.
  before insert or update of lead_id on students
  for each row execute function public.student_inherit_lead_associate();

create or replace function public.lead_associate_to_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by_associate is not null
     and new.referred_by_associate is distinct from old.referred_by_associate then
    update students set referred_by_associate = new.referred_by_associate
    where lead_id = new.id and referred_by_associate is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_associate_to_student on leads;
create trigger trg_lead_associate_to_student
  after update of referred_by_associate on leads
  for each row execute function public.lead_associate_to_student();

-- Backfill students converted before this migration.
update students s
set referred_by_associate = l.referred_by_associate
from leads l
where l.id = s.lead_id
  and s.referred_by_associate is null
  and l.referred_by_associate is not null;
