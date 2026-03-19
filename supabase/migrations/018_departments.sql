-- Create departments table
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create department sub-sections table (University/Board)
create table if not exists department_sub_sections (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Add columns to leads table
alter table leads 
add column if not exists department_id uuid references departments(id) on delete set null,
add column if not exists sub_section_id uuid references department_sub_sections(id) on delete set null;

-- Enable RLS
alter table departments enable row level security;
alter table department_sub_sections enable row level security;

-- Policies for departments
create policy "Authenticated users can view departments"
  on departments for select using (auth.uid() is not null);

create policy "Admins can manage departments"
  on departments for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Policies for sub-sections
create policy "Authenticated users can view sub_sections"
  on department_sub_sections for select using (auth.uid() is not null);

create policy "Admins can manage sub_sections"
  on department_sub_sections for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
