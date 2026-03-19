create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'rent','utilities','marketing','travel','salary','vendor','misc','other'
  )),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  payment_mode text,
  bill_url text,
  notes text,
  submitted_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

create policy "Finance and admin can view all expenses"
  on expenses for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','finance'))
  );

create policy "All staff can submit expenses"
  on expenses for insert
  with check (auth.uid() is not null);

create policy "Finance and admin can update expenses"
  on expenses for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','finance'))
  );
