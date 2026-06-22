-- PaceMint independent-account production hardening.
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

begin;

-- Structural month buckets allow month-scoped queries while sensitive dates
-- remain encrypted. Existing rows stay nullable and are backfilled by clients
-- after successful decryption.
alter table public.expenses add column if not exists month_key text;
alter table public.one_time_income add column if not exists month_key text;

alter table public.expenses drop constraint if exists expenses_month_key_format;
alter table public.expenses add constraint expenses_month_key_format
  check (month_key is null or month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.one_time_income drop constraint if exists one_time_income_month_key_format;
alter table public.one_time_income add constraint one_time_income_month_key_format
  check (month_key is null or month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create index if not exists user_settings_user_id_idx on public.user_settings (user_id);
create index if not exists budget_categories_user_id_idx on public.budget_categories (user_id);
create index if not exists recurring_expenses_user_id_idx on public.recurring_expenses (user_id);
create index if not exists expenses_user_month_idx on public.expenses (user_id, month_key);
create index if not exists one_time_income_user_month_idx on public.one_time_income (user_id, month_key);

-- Prevent duplicate recurring occurrences when multiple tabs refresh at once.
create unique index if not exists expenses_recurring_month_unique
  on public.expenses (user_id, recurring_id, month_key);

-- Accounts without MFA continue at AAL1. Once a user enrolls a verified
-- factor, their financial rows require an AAL2 session.
create or replace function public.mfa_requirement_met()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke all on function public.mfa_requirement_met() from public, anon;
grant execute on function public.mfa_requirement_met() to authenticated;

-- Drop all pre-existing policies on account-owned tables. PostgreSQL combines
-- permissive policies with OR, so leaving one stale broad policy would defeat
-- a new owner-only policy.
do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'user_settings',
    'budget_categories',
    'expenses',
    'recurring_expenses',
    'one_time_income',
    'user_keys'
  ] loop
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', policy_record.policyname, target_table);
    end loop;
    execute format('alter table public.%I enable row level security', target_table);
    execute format('alter table public.%I force row level security', target_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id and (select public.mfa_requirement_met())) with check ((select auth.uid()) = user_id and (select public.mfa_requirement_met()))',
      target_table || '_owner_access',
      target_table
    );
  end loop;
end $$;

-- Atomic, per-account daily AI quota. The table is not writable directly by
-- browser clients; authenticated callers can only consume their own quota via
-- the security-definer function below.
create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.ai_daily_usage enable row level security;
alter table public.ai_daily_usage force row level security;
revoke all on public.ai_daily_usage from anon, authenticated;

create or replace function public.consume_ai_daily_quota(request_limit integer default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  accepted uuid;
  safe_limit integer := greatest(1, least(request_limit, 100));
begin
  if caller is null then
    return false;
  end if;
  if not public.mfa_requirement_met() then
    return false;
  end if;

  insert into public.ai_daily_usage (user_id, usage_date, request_count)
  values (caller, current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_daily_usage.request_count + 1
    where public.ai_daily_usage.request_count < safe_limit
  returning user_id into accepted;

  return accepted is not null;
end;
$$;

revoke all on function public.consume_ai_daily_quota(integer) from public, anon;
grant execute on function public.consume_ai_daily_quota(integer) to authenticated;

-- Called with the user's JWT immediately before the server deletes the Auth
-- identity. Explicit deletion avoids relying on unknown legacy FK behavior.
create or replace function public.delete_current_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not public.mfa_requirement_met() then
    raise exception 'Multi-factor verification required';
  end if;
  delete from public.ai_daily_usage where user_id = caller;
  delete from public.one_time_income where user_id = caller;
  delete from public.expenses where user_id = caller;
  delete from public.recurring_expenses where user_id = caller;
  delete from public.budget_categories where user_id = caller;
  delete from public.user_settings where user_id = caller;
  delete from public.user_keys where user_id = caller;
end;
$$;

revoke all on function public.delete_current_user_data() from public, anon;
grant execute on function public.delete_current_user_data() to authenticated;

commit;
