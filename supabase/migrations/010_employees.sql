create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  employee_code text not null unique default 'EMP-' || floor(random() * 90000 + 10000)::text,
  department text,
  designation text,
  joining_date date,
  basic_salary numeric(12,2) default 0,
  hra numeric(12,2) default 0,
  allowances numeric(12,2) default 0,
  incentive numeric(12,2) default 0,
  pf_deduction numeric(12,2) default 0,
  tds_deduction numeric(12,2) default 0,
  other_deductions numeric(12,2) default 0,
  bank_account text,
  bank_ifsc text,
  bank_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employees enable row level security;

create policy "Admins can manage employees"
  on employees for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Employees can view own record"
  on employees for select
  using (profile_id = auth.uid());
