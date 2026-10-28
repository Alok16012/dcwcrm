-- Email OTPs for students changing their portal password.
-- Only the server (service role) touches this table: RLS is on with no
-- policies, so students can neither read codes nor reset attempt counters.
-- Codes are stored hashed; one live code per student.

create table if not exists student_password_otps (
  student_id uuid primary key references students(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  -- send timestamps in the last hour, for rate limiting
  sent_at timestamptz[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table student_password_otps enable row level security;
