-- LMS module: courses → modules → lessons, MCQ tests, live classes and
-- announcements, delivered to students in the /student portal.
--
-- LMS courses are separate from the CRM's `courses` (which are admission
-- levels like "Undergraduate"). An LMS course can be linked to a CRM course /
-- sub-course; with auto_enroll on, every student admitted to it gets access
-- without an explicit lms_enrollments row.
--
-- Staff access: admin + backend roles, or anyone granted the 'lms' module
-- right. Students reach only published content of courses they can access.
-- Correct answers never leave the database for students: questions are read
-- through lms_test_questions() and graded inside lms_submit_test().

-- ── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.lms_is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role in ('admin', 'backend') or 'lms' = any(coalesce(module_rights, '{}')))
  )
$$;

create or replace function public.lms_my_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from students where portal_user_id = auth.uid() limit 1
$$;

-- ── Tables ─────────────────────────────────────────────────────────────────

create table if not exists lms_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  thumbnail_url text,
  crm_course_id uuid references courses(id) on delete set null,
  crm_sub_course_id uuid references sub_courses(id) on delete set null,
  auto_enroll boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lms_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references lms_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lms_modules_course on lms_modules(course_id, sort_order);

create table if not exists lms_tests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references lms_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  duration_min integer not null default 30 check (duration_min > 0),
  pass_percent integer not null default 40 check (pass_percent between 0 and 100),
  negative_marks numeric(5,2) not null default 0 check (negative_marks >= 0),
  max_attempts integer not null default 0 check (max_attempts >= 0), -- 0 = unlimited
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lms_tests_course on lms_tests(course_id);

create table if not exists lms_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references lms_tests(id) on delete cascade,
  question text not null,
  opt_a text not null,
  opt_b text not null,
  opt_c text not null default '',
  opt_d text not null default '',
  correct text not null check (correct in ('a', 'b', 'c', 'd')),
  marks numeric(5,2) not null default 1 check (marks > 0),
  explanation text not null default '',
  sort_order integer not null default 0
);
create index if not exists idx_lms_questions_test on lms_questions(test_id, sort_order);

create table if not exists lms_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references lms_modules(id) on delete cascade,
  course_id uuid not null references lms_courses(id) on delete cascade,
  title text not null,
  type text not null default 'video' check (type in ('video', 'pdf', 'text', 'link', 'test')),
  video_url text,
  file_url text,
  body text not null default '',
  test_id uuid references lms_tests(id) on delete set null,
  duration_min integer not null default 0 check (duration_min >= 0),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lms_lessons_module on lms_lessons(module_id, sort_order);
create index if not exists idx_lms_lessons_course on lms_lessons(course_id);

create table if not exists lms_enrollments (
  student_id uuid not null references students(id) on delete cascade,
  course_id uuid not null references lms_courses(id) on delete cascade,
  enrolled_by uuid references profiles(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  primary key (student_id, course_id)
);
create index if not exists idx_lms_enrollments_course on lms_enrollments(course_id);

create table if not exists lms_lesson_progress (
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid not null references lms_lessons(id) on delete cascade,
  course_id uuid not null references lms_courses(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);
create index if not exists idx_lms_progress_course on lms_lesson_progress(course_id, student_id);

create table if not exists lms_test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references lms_tests(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  answers jsonb not null default '{}',
  score numeric(7,2) not null default 0,
  total numeric(7,2) not null default 0,
  correct_cnt integer not null default 0,
  wrong_cnt integer not null default 0,
  unattempted integer not null default 0,
  passed boolean not null default false,
  started_at timestamptz,
  submitted_at timestamptz not null default now()
);
create index if not exists idx_lms_attempts_test on lms_test_attempts(test_id, student_id);

create table if not exists lms_live_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references lms_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  duration_min integer not null default 60 check (duration_min > 0),
  join_url text,
  recording_url text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lms_classes_course on lms_live_classes(course_id, start_at);

create table if not exists lms_announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references lms_courses(id) on delete cascade, -- null = every LMS student
  title text not null,
  body text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Access check (needs lms_courses / lms_enrollments to exist) ───────────

create or replace function public.lms_can_access_course(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from lms_courses c
    join students s on s.portal_user_id = auth.uid()
    where c.id = p_course
      and c.status = 'published'
      and (
        exists (select 1 from lms_enrollments e where e.course_id = c.id and e.student_id = s.id)
        or (
          c.auto_enroll
          and c.crm_course_id is not null
          and c.crm_course_id = s.course_id
          and (c.crm_sub_course_id is null or c.crm_sub_course_id = s.sub_course_id)
        )
      )
  )
$$;

create or replace function public.lms_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_lms_courses_updated on lms_courses;
create trigger trg_lms_courses_updated before update on lms_courses
  for each row execute function public.lms_touch_updated_at();

-- ── Row level security ─────────────────────────────────────────────────────

alter table lms_courses         enable row level security;
alter table lms_modules         enable row level security;
alter table lms_lessons         enable row level security;
alter table lms_tests           enable row level security;
alter table lms_questions       enable row level security;
alter table lms_enrollments     enable row level security;
alter table lms_lesson_progress enable row level security;
alter table lms_test_attempts   enable row level security;
alter table lms_live_classes    enable row level security;
alter table lms_announcements   enable row level security;

-- Staff manage everything.
do $$
declare t text;
begin
  foreach t in array array['lms_courses','lms_modules','lms_lessons','lms_tests','lms_questions',
                           'lms_enrollments','lms_lesson_progress','lms_test_attempts',
                           'lms_live_classes','lms_announcements']
  loop
    execute format('drop policy if exists "lms staff manage" on %I', t);
    execute format('create policy "lms staff manage" on %I for all using (public.lms_is_manager()) with check (public.lms_is_manager())', t);
  end loop;
end $$;

-- Students: read what they can access. No policy on lms_questions — students
-- go through the functions below so they never see `correct`.
drop policy if exists "lms student read courses" on lms_courses;
create policy "lms student read courses" on lms_courses for select
  using (public.lms_can_access_course(id));

drop policy if exists "lms student read modules" on lms_modules;
create policy "lms student read modules" on lms_modules for select
  using (public.lms_can_access_course(course_id));

drop policy if exists "lms student read lessons" on lms_lessons;
create policy "lms student read lessons" on lms_lessons for select
  using (is_published and public.lms_can_access_course(course_id));

drop policy if exists "lms student read tests" on lms_tests;
create policy "lms student read tests" on lms_tests for select
  using (status = 'published' and public.lms_can_access_course(course_id));

drop policy if exists "lms student read classes" on lms_live_classes;
create policy "lms student read classes" on lms_live_classes for select
  using (public.lms_can_access_course(course_id));

drop policy if exists "lms student read announcements" on lms_announcements;
create policy "lms student read announcements" on lms_announcements for select
  using (
    (course_id is null and public.lms_my_student_id() is not null)
    or public.lms_can_access_course(course_id)
  );

drop policy if exists "lms student own enrollments" on lms_enrollments;
create policy "lms student own enrollments" on lms_enrollments for select
  using (student_id = public.lms_my_student_id());

drop policy if exists "lms student own attempts" on lms_test_attempts;
create policy "lms student own attempts" on lms_test_attempts for select
  using (student_id = public.lms_my_student_id());

drop policy if exists "lms student read progress" on lms_lesson_progress;
create policy "lms student read progress" on lms_lesson_progress for select
  using (student_id = public.lms_my_student_id());

drop policy if exists "lms student mark progress" on lms_lesson_progress;
create policy "lms student mark progress" on lms_lesson_progress for insert
  with check (
    student_id = public.lms_my_student_id()
    and public.lms_can_access_course(course_id)
    and exists (select 1 from lms_lessons l where l.id = lesson_id and l.course_id = lms_lesson_progress.course_id)
  );

drop policy if exists "lms student unmark progress" on lms_lesson_progress;
create policy "lms student unmark progress" on lms_lesson_progress for delete
  using (student_id = public.lms_my_student_id());

-- ── Test functions ─────────────────────────────────────────────────────────

-- Questions of a published test, without answers.
create or replace function public.lms_test_questions(p_test uuid)
returns table (id uuid, question text, opt_a text, opt_b text, opt_c text, opt_d text, marks numeric, sort_order integer)
language sql stable security definer set search_path = public as $$
  select q.id, q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.marks, q.sort_order
  from lms_questions q
  join lms_tests t on t.id = q.test_id
  where q.test_id = p_test
    and t.status = 'published'
    and (public.lms_can_access_course(t.course_id) or public.lms_is_manager())
  order by q.sort_order, q.id
$$;

-- Grade and store an attempt. p_answers = {"<question id>": "a" | "b" | "c" | "d"}.
create or replace function public.lms_submit_test(p_test uuid, p_answers jsonb, p_started_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.lms_my_student_id();
  v_test lms_tests%rowtype;
  v_used integer;
  v_score numeric := 0;
  v_total numeric := 0;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_skip integer := 0;
  v_ans text;
  q record;
  v_id uuid;
begin
  if v_student is null then raise exception 'Not a student account'; end if;
  select * into v_test from lms_tests where id = p_test and status = 'published';
  if not found or not public.lms_can_access_course(v_test.course_id) then
    raise exception 'Test not available';
  end if;
  if v_test.max_attempts > 0 then
    select count(*) into v_used from lms_test_attempts where test_id = p_test and student_id = v_student;
    if v_used >= v_test.max_attempts then raise exception 'No attempts left for this test'; end if;
  end if;

  for q in select id, correct, marks from lms_questions where test_id = p_test loop
    v_total := v_total + q.marks;
    v_ans := lower(coalesce(p_answers ->> q.id::text, ''));
    if v_ans = '' then
      v_skip := v_skip + 1;
    elsif v_ans = q.correct then
      v_correct := v_correct + 1;
      v_score := v_score + q.marks;
    else
      v_wrong := v_wrong + 1;
      v_score := v_score - v_test.negative_marks;
    end if;
  end loop;

  insert into lms_test_attempts (test_id, student_id, answers, score, total, correct_cnt, wrong_cnt, unattempted, passed, started_at)
  values (p_test, v_student, coalesce(p_answers, '{}'), v_score, v_total, v_correct, v_wrong, v_skip,
          v_total > 0 and v_score * 100 >= v_total * v_test.pass_percent, p_started_at)
  returning id into v_id;

  -- A test lesson counts as done once the student has submitted it.
  insert into lms_lesson_progress (student_id, lesson_id, course_id)
  select v_student, l.id, l.course_id from lms_lessons l where l.test_id = p_test
  on conflict do nothing;

  return v_id;
end $$;

-- Answer review for one of the caller's own attempts (or any, for staff).
create or replace function public.lms_attempt_review(p_attempt uuid)
returns table (id uuid, question text, opt_a text, opt_b text, opt_c text, opt_d text,
               correct text, chosen text, marks numeric, explanation text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select q.id, q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.correct,
         nullif(lower(a.answers ->> q.id::text), ''), q.marks, q.explanation, q.sort_order
  from lms_test_attempts a
  join lms_questions q on q.test_id = a.test_id
  where a.id = p_attempt
    and (a.student_id = public.lms_my_student_id() or public.lms_is_manager())
  order by q.sort_order, q.id
$$;

revoke all on function public.lms_submit_test(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.lms_submit_test(uuid, jsonb, timestamptz) to authenticated;
revoke all on function public.lms_test_questions(uuid) from public, anon;
grant execute on function public.lms_test_questions(uuid) to authenticated;
revoke all on function public.lms_attempt_review(uuid) from public, anon;
grant execute on function public.lms_attempt_review(uuid) to authenticated;

-- ── Storage for lesson files (PDFs, thumbnails, short videos) ─────────────

insert into storage.buckets (id, name, public)
values ('lms-content', 'lms-content', true)
on conflict (id) do nothing;

drop policy if exists "lms_content_staff_insert" on storage.objects;
create policy "lms_content_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lms-content' and public.lms_is_manager());

drop policy if exists "lms_content_staff_update" on storage.objects;
create policy "lms_content_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'lms-content' and public.lms_is_manager());

drop policy if exists "lms_content_staff_delete" on storage.objects;
create policy "lms_content_staff_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lms-content' and public.lms_is_manager());
