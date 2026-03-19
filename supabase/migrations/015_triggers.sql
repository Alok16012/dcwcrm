-- Auto updated_at
create extension if not exists moddatetime schema extensions;

create trigger set_updated_at_profiles
  before update on profiles
  for each row execute procedure moddatetime(updated_at);

create trigger set_updated_at_leads
  before update on leads
  for each row execute procedure moddatetime(updated_at);

create trigger set_updated_at_students
  before update on students
  for each row execute procedure moddatetime(updated_at);

create trigger set_updated_at_employees
  before update on employees
  for each row execute procedure moddatetime(updated_at);

-- Lead conversion → auto-create student
create or replace function handle_lead_conversion()
returns trigger as $$
begin
  if NEW.status = 'converted' and OLD.status != 'converted' then
    insert into students (
      lead_id, full_name, phone, email,
      course_id, sub_course_id, assigned_counsellor,
      total_fee, amount_paid, enrollment_date
    ) values (
      NEW.id, NEW.full_name, NEW.phone, NEW.email,
      NEW.course_id, NEW.sub_course_id, NEW.assigned_to,
      NEW.total_fee, NEW.amount_paid, current_date
    )
    on conflict (lead_id) do nothing;
    NEW.converted_at = now();
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_lead_converted
  before update on leads
  for each row execute procedure handle_lead_conversion();

-- Payment insert → update amount_paid on leads and students
create or replace function handle_payment_insert()
returns trigger as $$
begin
  if NEW.lead_id is not null then
    update leads set
      amount_paid = (select coalesce(sum(amount),0) from payments where lead_id = NEW.lead_id)
    where id = NEW.lead_id;
  end if;

  if NEW.lead_id is not null then
    update students set
      amount_paid = (select coalesce(sum(amount),0) from payments where lead_id = NEW.lead_id)
    where lead_id = NEW.lead_id;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_payment_inserted
  after insert on payments
  for each row execute procedure handle_payment_insert();

-- Auto-log lead created
create or replace function log_lead_created()
returns trigger as $$
begin
  insert into lead_activities (lead_id, activity_type, new_value, performed_by)
  values (NEW.id, 'created', NEW.status, NEW.created_by);
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_lead_created
  after insert on leads
  for each row execute procedure log_lead_created();

-- Auto-log lead status/assignment change
create or replace function log_lead_status_change()
returns trigger as $$
begin
  if OLD.status != NEW.status then
    insert into lead_activities (lead_id, activity_type, old_value, new_value, performed_by)
    values (NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid());
  end if;
  if OLD.assigned_to is distinct from NEW.assigned_to then
    insert into lead_activities (lead_id, activity_type, old_value, new_value, performed_by)
    values (NEW.id, 'assigned',
      (select full_name from profiles where id = OLD.assigned_to),
      (select full_name from profiles where id = NEW.assigned_to),
      auth.uid());
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_lead_updated
  after update on leads
  for each row execute procedure log_lead_status_change();
