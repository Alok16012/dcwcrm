create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','half_day','late','leave','holiday')),
  clock_in time,
  clock_out time,
  notes text,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

alter table attendance enable row level security;

create policy "Admins can manage attendance"
  on attendance for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Employees can view own attendance"
  on attendance for select
  using (
    exists (select 1 from employees where id = employee_id and profile_id = auth.uid())
  );
