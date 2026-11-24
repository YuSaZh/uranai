-- ============================================================================
-- Uranai Tarot Divination Web App — Initial Supabase Schema (Idempotent)
-- Run this script in your Supabase SQL Editor to enable multi-device sync.
-- ============================================================================

-- 1. User Preferences Table
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_id text not null default 'celestial-velvet',
  deck_id text not null default 'rider-waite',
  sound_enabled boolean not null default true,
  haptics_enabled boolean not null default true,
  gyro_enabled boolean not null default true,
  allow_reversed boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2. Divination Readings History Table
create table if not exists public.readings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('daily', 'spread')),
  date_key text not null,
  category text,
  question text,
  spread_id text,
  deck_id text not null,
  theme_id text not null,
  cards jsonb not null default '[]'::jsonb,
  ai_interpretation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Performance Indexes
create index if not exists idx_readings_user_created_at
  on public.readings (user_id, created_at desc);

create index if not exists idx_readings_user_mode_date
  on public.readings (user_id, mode, date_key);

-- 4. Enable Row Level Security
alter table public.user_preferences enable row level security;
alter table public.readings enable row level security;

-- 5. Strict RLS Policies — public.user_preferences
drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
  on public.user_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own"
  on public.user_preferences
  for delete
  using (auth.uid() = user_id);

-- 6. Strict RLS Policies — public.readings
drop policy if exists "readings_select_own" on public.readings;
create policy "readings_select_own"
  on public.readings
  for select
  using (auth.uid() = user_id);

drop policy if exists "readings_insert_own" on public.readings;
create policy "readings_insert_own"
  on public.readings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "readings_update_own" on public.readings;
create policy "readings_update_own"
  on public.readings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "readings_delete_own" on public.readings;
create policy "readings_delete_own"
  on public.readings
  for delete
  using (auth.uid() = user_id);
