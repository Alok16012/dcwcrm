create table if not exists lead_column_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  column_key text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, column_key)
);

alter table lead_column_preferences enable row level security;

create policy "Users manage own preferences"
  on lead_column_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
