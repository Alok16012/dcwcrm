create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  basic numeric(12,2) not null default 0,
  hra numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  incentive numeric(12,2) not null default 0,
  gross numeric(12,2) not null default 0,
  pf numeric(12,2) not null default 0,
  tds numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  net numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','processed','paid')),
  payment_date date,
  created_at timestamptz not null default now(),
  unique (employee_id, month, year)
);

alter table payroll enable row level security;

create policy "Admins can manage payroll"
  on payroll for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Employees can view own payroll"
  on payroll for select
  using (
    exists (select 1 from employees where id = employee_id and profile_id = auth.uid())
  );
