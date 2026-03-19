create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  city text,
  state text,
  course_id uuid references courses(id) on delete set null,
  sub_course_id uuid references sub_courses(id) on delete set null,
  status text not null default 'new' check (status in (
    'new','contacted','interested','counselled','application_sent','converted','cold','lost'
  )),
  source text not null check (source in (
    'website','walk_in','referral','whatsapp','phone','excel_import','social_media','other'
  )),
  assigned_to uuid references profiles(id) on delete set null,
  assigned_at timestamptz,
  next_followup_date date,
  total_fee numeric(12,2),
  amount_paid numeric(12,2) not null default 0,
  converted_at timestamptz,
  import_batch_id text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table leads enable row level security;

create policy "Admin and backend can view all leads"
  on leads for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend'))
  );

create policy "Telecaller can view own leads"
  on leads for select
  using (
    auth.uid() = assigned_to or auth.uid() = created_by
  );

create policy "Telecaller and admin can insert leads"
  on leads for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','telecaller','backend'))
  );

create policy "Admin and telecaller can update own leads"
  on leads for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or auth.uid() = assigned_to
  );
