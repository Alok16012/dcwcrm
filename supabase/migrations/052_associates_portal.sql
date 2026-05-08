-- Associates master table
create table if not exists associates (
  id uuid primary key default gen_random_uuid(),
  -- Basic Info
  name text not null,
  phone text not null,
  father_phone text,
  email text not null unique,
  -- KYC
  aadhar_number text,
  pan_number text,
  -- Current Address
  current_address text,
  current_city text,
  current_state text,
  current_pincode text,
  -- Permanent Address
  permanent_address text,
  permanent_city text,
  permanent_state text,
  permanent_pincode text,
  same_as_current boolean not null default false,
  -- Bank Details
  bank_name text,
  account_number text,
  ifsc_code text,
  account_holder_name text,
  -- Status & Auth
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  associate_code text unique,
  user_id uuid,
  wallet_balance numeric not null default 0,
  rejection_reason text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid
);

-- Wallet transaction log
create table if not exists associate_wallet_txns (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid not null references associates(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric not null,
  reason text,
  created_at timestamptz not null default now()
);

-- Per-associate notifications
create table if not exists associate_notifications (
  id uuid primary key default gen_random_uuid(),
  associate_id uuid references associates(id) on delete cascade,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Dispatch / kit shipments sent to associates
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

-- Link students/leads to the associate who referred them
alter table leads
  add column if not exists referred_by_associate uuid references associates(id);
