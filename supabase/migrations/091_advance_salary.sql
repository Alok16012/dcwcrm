-- Advance salary ledger + payroll advance deduction column

create table if not exists advance_salaries (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  given_on    date not null default current_date,
  reason      text,
  status      text not null default 'pending' check (status in ('pending','settled','cancelled')),
  settled_in  uuid references payroll(id) on delete set null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_adv_emp on advance_salaries(employee_id);

alter table advance_salaries enable row level security;

drop policy if exists "adv_admin_all" on advance_salaries;
create policy "adv_admin_all" on advance_salaries for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend')));

drop policy if exists "adv_employee_read" on advance_salaries;
create policy "adv_employee_read" on advance_salaries for select
  using (exists (select 1 from employees where id = employee_id and profile_id = auth.uid()));

alter table payroll add column if not exists advance_deduction numeric(10,2) not null default 0;

notify pgrst, 'reload schema';
