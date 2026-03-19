create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  student_id uuid,  -- will add FK after students table created
  amount numeric(12,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('cash','upi','card','neft','rtgs','cheque','other')),
  payment_date date not null,
  receipt_number text,
  notes text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table payments enable row level security;

create policy "Admin, backend, finance can view payments"
  on payments for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend','finance'))
  );

create policy "Backend and admin can insert payments"
  on payments for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend'))
  );
