-- The dispatch form captures the student's father's name but the table was
-- missing the column, causing inserts to fail with
-- "Could not find the 'father_name' column of 'student_dispatches'".
alter table student_dispatches
  add column if not exists father_name text;
