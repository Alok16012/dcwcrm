create table if not exists student_exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  exam_type text not null check (exam_type in (
    'ielts','pte','toefl','practical','final_exam','mock_test','other'
  )),
  exam_name text not null,
  exam_date date,
  centre text,
  hall_ticket_number text,
  admit_card_url text,
  score text,
  is_passed boolean,
  remarks text,
  created_at timestamptz not null default now()
);

alter table student_exams enable row level security;

create policy "Admin and backend can manage exams"
  on student_exams for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','backend'))
  );
