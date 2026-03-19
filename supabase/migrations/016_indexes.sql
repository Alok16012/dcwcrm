-- Performance indexes
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_assigned_to on leads(assigned_to);
create index if not exists idx_leads_created_at on leads(created_at desc);
create index if not exists idx_leads_next_followup on leads(next_followup_date);
create index if not exists idx_leads_import_batch on leads(import_batch_id);
create index if not exists idx_leads_phone on leads(phone);
create index if not exists idx_leads_source on leads(source);

create index if not exists idx_lead_activities_lead_id on lead_activities(lead_id);
create index if not exists idx_lead_activities_created_at on lead_activities(created_at desc);

create index if not exists idx_payments_lead_id on payments(lead_id);
create index if not exists idx_payments_student_id on payments(student_id);
create index if not exists idx_payments_payment_date on payments(payment_date desc);

create index if not exists idx_students_course_id on students(course_id);
create index if not exists idx_students_assigned_counsellor on students(assigned_counsellor);
create index if not exists idx_students_status on students(status);

create index if not exists idx_student_documents_student_id on student_documents(student_id);
create index if not exists idx_student_exams_student_id on student_exams(student_id);

create index if not exists idx_attendance_employee_date on attendance(employee_id, date);
create index if not exists idx_payroll_employee_month on payroll(employee_id, year, month);
create index if not exists idx_expenses_status on expenses(status);
create index if not exists idx_expenses_date on expenses(expense_date desc);
