-- PaceMint end-to-end encryption schema.
--
-- Run this in the Supabase SQL editor (it accepts the whole script). If you use
-- a client that errors with "cannot insert multiple commands into a prepared
-- statement", run each statement below individually.
--
-- It adds the key-storage table and
-- converts the data tables to store sensitive fields inside an encrypted
-- `enc_payload` column. Structural columns (ids, foreign keys, timestamps)
-- stay in cleartext so relations and row-level security keep working. This
-- file alone also enables forced, owner-only row-level security on every
-- table (section 7) -- supabase/migrations/*.sql files upgrade that baseline
-- (e.g. to MFA-gated policies) but are not required for RLS to be active.
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

-- Baseline RLS for every table is established once, in section 7 below (a
-- single guarded block covering all 6 tables) rather than per-table here, so
-- this file is self-sufficient even if the hardening migration is skipped.

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

-- 7. Baseline row-level security (idempotent; self-sufficient) --------------
-- Every table gets forced, owner-only RLS from this block alone, so the app
-- is never left with zero RLS just because
-- supabase/migrations/202606190001_multi_user_hardening.sql was skipped or
-- forgotten (it's applied by hand in the SQL editor -- there is no migration
-- runner). That migration later upgrades this baseline to an MFA-gated
-- policy.
--
-- Guard: if public.mfa_requirement_met() already exists, the hardening
-- migration has already run -- skip this block entirely so re-applying this
-- file (e.g. against a project that's already hardened) never recreates a
-- weaker, non-MFA policy that would OR-combine with the migration's
-- stronger one.
do $$
declare
  target_table text;
  policy_record record;
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'mfa_requirement_met' and n.nspname = 'public'
  ) then
    raise notice 'Production hardening migration already applied; baseline RLS block skipped.';
    return;
  end if;

  foreach target_table in array array[
    'user_settings',
    'budget_categories',
    'expenses',
    'recurring_expenses',
    'one_time_income',
    'user_keys'
  ] loop
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', policy_record.policyname, target_table);
    end loop;
    execute format('alter table public.%I enable row level security', target_table);
    execute format('alter table public.%I force row level security', target_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      target_table || '_baseline_owner_access',
      target_table
    );
  end loop;
end $$;

-- Apply every file in supabase/migrations after this one. Those migrations
-- upgrade this baseline to MFA-gated, add indexes, month buckets, AI quotas,
-- and account deletion.
