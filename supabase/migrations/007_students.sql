create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null unique,
  enrollment_number text not null unique default 'ENR-' || floor(random() * 900000 + 100000)::text,
  full_name text not null,
  phone text not null,
  email text,
  city text,
  course_id uuid references courses(id) on delete set null,
  sub_course_id uuid references sub_courses(id) on delete set null,
  assigned_counsellor uuid references profiles(id) on delete set null,
  total_fee numeric(12,2),
  amount_paid numeric(12,2) not null default 0,
  enrollment_date date,
  status text not null default 'active' check (status in ('active','completed','dropped','on_hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add FK from payments to students
alter table payments add constraint payments_student_id_fkey
  foreign key (student_id) references students(id) on delete set null;

alter table students enable row level security;

create policy "Admin and backend can view all students"
  on students for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend','finance'))
  );

create policy "Admin and backend can manage students"
  on students for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend'))
  );
