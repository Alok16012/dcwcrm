-- Ensure student_dispatches has every column the Dispatch/Receive form writes.
-- Safe to run multiple times (IF NOT EXISTS on each column).

alter table student_dispatches add column if not exists dispatch_type     text;
alter table student_dispatches add column if not exists student_name      text;
alter table student_dispatches add column if not exists student_phone     text;
alter table student_dispatches add column if not exists father_name       text;
alter table student_dispatches add column if not exists enrollment_number text;
alter table student_dispatches add column if not exists associate_id      uuid;
alter table student_dispatches add column if not exists document_type     text;
alter table student_dispatches add column if not exists courier           text;
alter table student_dispatches add column if not exists tracking_number   text;
alter table student_dispatches add column if not exists dispatch_date     date;
alter table student_dispatches add column if not exists expected_delivery date;
alter table student_dispatches add column if not exists status            text;
alter table student_dispatches add column if not exists remarks           text;
alter table student_dispatches add column if not exists dispatched_by     uuid;
alter table student_dispatches add column if not exists created_at        timestamptz default now();
alter table student_dispatches add column if not exists updated_at        timestamptz default now();

-- Refresh PostgREST's schema cache so the new columns are picked up immediately.
notify pgrst, 'reload schema';
