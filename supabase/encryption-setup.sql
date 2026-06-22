-- PaceMint end-to-end encryption schema.
--
-- Run this in the Supabase SQL editor (it accepts the whole script). If you use
-- a client that errors with "cannot insert multiple commands into a prepared
-- statement", run each statement below individually.
--
-- It adds the key-storage table and
-- converts the data tables to store sensitive fields inside an encrypted
-- `enc_payload` column. Structural columns (ids, foreign keys, timestamps)
-- stay in cleartext so relations and row-level security keep working.
--
-- WARNING: the ALTER ... DROP COLUMN statements remove the old PLAINTEXT
-- columns and the data in them. The app cannot re-encrypt existing plaintext
-- server-side (only the user's in-browser key can). If you have real data,
-- export it from the old app version first, then re-import after migrating.

-- 1. Per-user wrapped Data Encryption Keys --------------------------------

create table if not exists public.user_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kdf_salt text not null,
  kdf_iterations integer not null default 600000,
  recovery_salt text not null,
  wrapped_dek_password text not null,
  wrapped_dek_recovery text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_keys enable row level security;

drop policy if exists "user_keys are private" on public.user_keys;
create policy "user_keys are private" on public.user_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. user_settings ---------------------------------------------------------

alter table public.user_settings add column if not exists enc_payload text;
alter table public.user_settings drop column if exists monthly_income;
alter table public.user_settings drop column if exists monthly_budget;
alter table public.user_settings drop column if exists savings_target;
-- saveSettings upserts on user_id, so it must be unique. A unique index works
-- as the conflict target and supports IF NOT EXISTS (no DO block needed).
create unique index if not exists user_settings_user_id_key on public.user_settings (user_id);

-- 3. budget_categories -----------------------------------------------------

alter table public.budget_categories add column if not exists enc_payload text;
-- The category name is now encrypted, so the old uniqueness constraint and
-- plaintext columns are removed; uniqueness is enforced in the client.
alter table public.budget_categories drop constraint if exists budget_categories_user_id_category_key;
alter table public.budget_categories drop column if exists category;
alter table public.budget_categories drop column if exists monthly_limit;

-- 4. expenses --------------------------------------------------------------

alter table public.expenses add column if not exists enc_payload text;
alter table public.expenses drop column if exists description;
alter table public.expenses drop column if exists amount;
alter table public.expenses drop column if exists category;
alter table public.expenses drop column if exists spent_on;

-- 5. recurring_expenses ----------------------------------------------------

alter table public.recurring_expenses add column if not exists enc_payload text;
alter table public.recurring_expenses drop column if exists description;
alter table public.recurring_expenses drop column if exists amount;
alter table public.recurring_expenses drop column if exists category;
alter table public.recurring_expenses drop column if exists day_of_month;

-- 6. one_time_income -------------------------------------------------------

create table if not exists public.one_time_income (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  enc_payload text,
  created_at timestamptz
);

alter table public.one_time_income enable row level security;

drop policy if exists "one_time_income owner access" on public.one_time_income;
create policy "one_time_income owner access" on public.one_time_income
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. Production hardening -------------------------------------------------
-- Apply every file in supabase/migrations after this one. Those migrations
-- enforce owner-only RLS, indexes, month buckets, AI quotas, and deletion.
