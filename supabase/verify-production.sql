-- Run after migrations. Every result should be true or contain exactly the
-- expected owner-access policy.
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
