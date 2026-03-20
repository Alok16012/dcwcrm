-- Add mode to leads
alter table leads add column if not exists mode text check (mode in ('attending', 'non-attending'));

-- Add fields to students
alter table students 
add column if not exists mode text check (mode in ('attending', 'non-attending')),
add column if not exists department_id uuid references departments(id) on delete set null,
add column if not exists sub_section_id uuid references department_sub_sections(id) on delete set null;
