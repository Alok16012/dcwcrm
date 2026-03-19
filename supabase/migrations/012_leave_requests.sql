create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type text not null check (leave_type in ('sick','casual','earned','unpaid','other')),
  from_date date not null,
  to_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table leave_requests enable row level security;

create policy "Admins can manage leave requests"
  on leave_requests for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Employees can manage own leave"
  on leave_requests for all
  using (
    exists (select 1 from employees where id = employee_id and profile_id = auth.uid())
  );
