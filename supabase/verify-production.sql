-- Run after applying encryption-setup.sql (and, ideally, the migrations in
-- supabase/migrations/). The block below hard-fails with `raise exception` if
-- any table is missing forced RLS or its hardened owner-access policy -- read
-- the error message before looking at the informational SELECTs further down.
do $$
declare
  t text;
  missing text[] := array[]::text[];
  rls_ok boolean;
  policy_ok boolean;
begin
  foreach t in array array[
    'user_settings', 'budget_categories', 'expenses',
    'recurring_expenses', 'one_time_income', 'user_keys'
  ] loop
    select relrowsecurity and relforcerowsecurity into rls_ok
    from pg_class where oid = ('public.' || t)::regclass;

    select exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_owner_access'
    ) into policy_ok;

    if not coalesce(rls_ok, false) then
      missing := missing || (t || ': RLS not enabled/forced');
    end if;
    if not policy_ok then
      missing := missing || (t || ': missing hardened "' || t || '_owner_access" policy (migration not applied? baseline "' || t || '_baseline_owner_access" policy is not sufficient for this check)');
    end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception 'RLS verification FAILED: %', array_to_string(missing, '; ');
  end if;

  raise notice 'RLS verification passed: all 6 tables have forced RLS and the hardened owner-only policy.';
end $$;

-- Informational detail below -- useful for a human to eyeball, not required
-- for the pass/fail result above.
select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where oid in (
  'public.user_settings'::regclass,
  'public.budget_categories'::regclass,
  'public.expenses'::regclass,
  'public.recurring_expenses'::regclass,
  'public.one_time_income'::regclass,
  'public.user_keys'::regclass,
  'public.ai_daily_usage'::regclass
)
order by relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_settings', 'budget_categories', 'expenses', 'recurring_expenses', 'one_time_income', 'user_keys')
order by tablename, policyname;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('expenses_user_month_idx', 'one_time_income_user_month_idx', 'expenses_recurring_month_unique')
order by indexname;
