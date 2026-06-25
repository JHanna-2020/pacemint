-- PaceMint bootstrap for a brand-new, empty Supabase project.
-- Safe to rerun: every table is created with IF NOT EXISTS.
--
-- After this file succeeds, run in order:
--   1. supabase/encryption-setup.sql
--   2. supabase/migrations/202606190001_multi_user_hardening.sql
--   3. notify pgrst, 'reload schema';

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enc_payload text,
  updated_at timestamptz default now()
);

create table if not exists public.budget_categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  enc_payload text,
  updated_at timestamptz default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  enc_payload text,
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  recurring_id uuid,
  enc_payload text,
  created_at timestamptz default now()
);

create table if not exists public.one_time_income (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  enc_payload text,
  created_at timestamptz default now()
);

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
