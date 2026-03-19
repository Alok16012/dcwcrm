create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "Authenticated users can view sessions"
  on sessions for select using (auth.uid() is not null);

create policy "Admins can manage sessions"
  on sessions for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Add column to leads table
alter table leads
add column if not exists session_id uuid references sessions(id) on delete set null;

