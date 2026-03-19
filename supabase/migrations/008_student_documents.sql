create table if not exists student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  doc_type text not null check (doc_type in (
    '10th_marksheet','12th_marksheet','graduation','passport',
    'sop','lor','ielts_scorecard','pte_scorecard','offer_letter','visa','other'
  )),
  status text not null default 'pending' check (status in ('pending','received','verified','rejected')),
  file_url text,
  notes text,
  expiry_date date,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, doc_type)
);

alter table student_documents enable row level security;

create policy "Admin and backend can manage documents"
  on student_documents for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend'))
  );
