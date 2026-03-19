-- Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'telecaller', 'backend', 'finance')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;

create policy "Users can view all active profiles"
  on profiles for select
  using (auth.uid() is not null);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Admins can manage all profiles"
  on profiles for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );
