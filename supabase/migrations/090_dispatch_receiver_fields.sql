-- Who collected the document when it was handed over at the office
-- (instead of couriered): the student themself or a guardian/relative.

alter table student_dispatches add column if not exists received_by       text; -- 'self' | 'guardian'
alter table student_dispatches add column if not exists receiver_name     text;
alter table student_dispatches add column if not exists receiver_relation text;
alter table student_dispatches add column if not exists receiver_phone    text;

notify pgrst, 'reload schema';
