-- Fee structures table
create table if not exists fee_structures (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  actual_fee numeric not null check (actual_fee >= 0),
  basic_percent numeric not null default 100 check (basic_percent >= 0 and basic_percent <= 200),
  standard_percent numeric not null default 100 check (standard_percent >= 0 and standard_percent <= 200),
  premium_percent numeric not null default 100 check (premium_percent >= 0 and premium_percent <= 200),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, course_id, session_id)
);

alter table fee_structures enable row level security;

-- All authenticated users can view fees (associates, counselors, etc.)
create policy "Authenticated users can view fee structures"
  on fee_structures for select using (auth.uid() is not null);

-- Only admin and backend can manage fees
create policy "Admin and backend can manage fee structures"
  on fee_structures for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'backend'))
  );
