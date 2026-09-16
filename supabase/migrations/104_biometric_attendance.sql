-- Biometric attendance (Dahua DHI-ASI3204E-W face / card / fingerprint controller)
--
-- The device lives on the office LAN and cannot be reached from Railway, so a
-- small bridge agent on the LAN streams its events to /api/biometric/punch.
-- Every raw event lands in biometric_punches; the day's first and last valid
-- punch are then rolled up into the existing attendance row.

-- ---------------------------------------------------------------- devices ---
create table if not exists biometric_devices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  model         text not null default 'DHI-ASI3204E-W',
  serial_no     text unique,
  ip_address    text,
  location      text,
  is_active     boolean not null default true,
  -- Health, written by the bridge agent's heartbeat.
  last_seen_at  timestamptz,
  last_event_at timestamptz,
  agent_version text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- punches ---
create table if not exists biometric_punches (
  id                 uuid primary key default gen_random_uuid(),
  device_id          uuid references biometric_devices(id) on delete set null,
  device_serial      text,
  -- Identity as the device knows it. biometric_user_id is the UserID field
  -- configured on the controller; card_no is the fallback for card-only users.
  biometric_user_id  text,
  card_no            text,
  card_name          text,
  employee_id        uuid references employees(id) on delete set null,
  -- punched_at is the true instant; punch_date/punch_time are the IST values
  -- the attendance table is keyed on, precomputed so queries stay simple.
  punched_at         timestamptz not null,
  punch_date         date not null,
  punch_time         time not null,
  method             text,
  raw_method         integer,
  direction          text,
  door               integer,
  status             text not null default 'success',
  error_code         integer,
  event_code         text,
  rec_no             bigint,
  source             text not null default 'agent' check (source in ('agent', 'poll', 'manual')),
  -- device + user + second: the same punch arriving from both the live stream
  -- and the catch-up poller collapses into one row.
  dedupe_key         text not null unique,
  applied            boolean not null default false,
  raw                jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists idx_biometric_punches_date     on biometric_punches (punch_date desc);
create index if not exists idx_biometric_punches_employee on biometric_punches (employee_id, punch_date desc);
create index if not exists idx_biometric_punches_user     on biometric_punches (biometric_user_id);
create index if not exists idx_biometric_punches_unmapped on biometric_punches (punch_date desc) where employee_id is null;

-- ------------------------------------------------- employee device mapping ---
alter table employees
  add column if not exists biometric_user_id text,
  add column if not exists biometric_card_no text,
  add column if not exists biometric_enrolled_at timestamptz;

create unique index if not exists idx_employees_biometric_user_id
  on employees (biometric_user_id) where biometric_user_id is not null;

-- ------------------------------------------------------ attendance origin ---
alter table attendance
  add column if not exists source text not null default 'manual',
  add column if not exists biometric_device_id uuid references biometric_devices(id) on delete set null;

-- ------------------------------------------------------------------- RLS ----
alter table biometric_devices enable row level security;
alter table biometric_punches enable row level security;

drop policy if exists "Admins and backend manage devices" on biometric_devices;
create policy "Admins and backend manage devices"
  on biometric_devices for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'backend')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'backend')));

drop policy if exists "Admins and backend manage punches" on biometric_punches;
create policy "Admins and backend manage punches"
  on biometric_punches for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'backend')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'backend')));

drop policy if exists "Employees can view own punches" on biometric_punches;
create policy "Employees can view own punches"
  on biometric_punches for select
  using (exists (select 1 from employees where id = employee_id and profile_id = auth.uid()));
