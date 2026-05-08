-- Run this FULL script in Supabase SQL Editor to set up all associate tables

-- 1. Associates master table
create table if not exists associates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  father_phone text,
  email text not null unique,
  aadhar_number text,
  pan_number text,
  current_address text,
  current_city text,
  current_state text,
  current_pincode text,
  permanent_address text,
  permanent_city text,
  permanent_state text,
  permanent_pincode text,
  same_as_current boolean not null default false,
  bank_name text,
  account_number text,
  ifsc_code text,
  account_holder_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  associate_code text unique,
  user_id uuid,
  wallet_balance numeric not null default 0,
  rejection_reason text,
  coordinator_id uuid references profiles(id),
  coordinator_name text,
  temp_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid
);

-- 2. Wallet transactions
create table if not exists associate_wallet_txns (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid not null references associates(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric not null,
  reason text,
  created_at timestamptz not null default now()
);

-- 3. Notifications
create table if not exists associate_notifications (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid references associates(id) on delete cascade,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4. Dispatches
create table if not exists associate_dispatches (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid not null references associates(id) on delete cascade,
  item_name text not null,
  quantity int not null default 1,
  tracking_number text,
  status text not null default 'processing' check (status in ('processing', 'shipped', 'delivered')),
  dispatched_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. Wallet recharge requests
create table if not exists wallet_recharge_requests (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid not null references associates(id) on delete cascade,
  amount numeric not null,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  approved_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- 6. Add referred_by_associate to leads (if not exists)
alter table leads
  add column if not exists referred_by_associate uuid references associates(id);

-- 7. Add missing columns to existing associates table (if table already existed)
alter table associates
  add column if not exists coordinator_id uuid references profiles(id),
  add column if not exists coordinator_name text,
  add column if not exists temp_password text;
