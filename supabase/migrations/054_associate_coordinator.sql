alter table associates
  add column if not exists coordinator_id uuid references profiles(id),
  add column if not exists coordinator_name text;
