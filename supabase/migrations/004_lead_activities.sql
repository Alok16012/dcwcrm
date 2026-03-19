create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'created','status_changed','assigned','transferred','note_added',
    'followup_set','payment_received','converted','document_uploaded','call_made'
  )),
  old_value text,
  new_value text,
  note text,
  performed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table lead_activities enable row level security;

create policy "Users with lead access can view activities"
  on lead_activities for select
  using (auth.uid() is not null);

create policy "Users can insert activities"
  on lead_activities for insert
  with check (auth.uid() is not null);
