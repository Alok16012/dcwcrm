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
