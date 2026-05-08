-- Add document URL columns to associates table
alter table associates
  add column if not exists aadhar_doc_url text,
  add column if not exists pan_doc_url text,
  add column if not exists cheque_doc_url text;
