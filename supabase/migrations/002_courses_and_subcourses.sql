create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sub_courses (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table courses enable row level security;
alter table sub_courses enable row level security;

create policy "Authenticated users can view courses"
  on courses for select using (auth.uid() is not null);

create policy "Admins can manage courses"
  on courses for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authenticated users can view sub_courses"
  on sub_courses for select using (auth.uid() is not null);

create policy "Admins can manage sub_courses"
  on sub_courses for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
