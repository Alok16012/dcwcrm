alter table associates
  add column if not exists state text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists institution_name text,
  add column if not exists institution_address text;
