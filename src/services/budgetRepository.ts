import { supabase } from '../lib/supabase';
import {
  BudgetCategory,
  BudgetCategoryRow,
  Category,
  CategoryPayload,
  Expense,
  ExpenseDraft,
  ExpensePayload,
  ExpenseRow,
  BudgetPeriod,
  MonthData,
  OneTimeIncome,
  OneTimeIncomeDraft,
  OneTimeIncomePayload,
  OneTimeIncomeRow,
  RecurringDraft,
  RecurringExpense,
  RecurringExpenseRow,
  RecurringPayload,
  SettingsPayload,
  UserSettings,
  UserSettingsRow
} from '../lib/types';
import { monthBounds, dateForMonthDay, monthKeysForRange, monthlyPeriod } from '../lib/date';
import { decryptJSON, encryptJSON } from '../lib/crypto';
import { getDEK } from '../lib/encryptionSession';

const nowIso = () => new Date().toISOString();

function id(): string {
  return crypto.randomUUID();
}

// All sensitive fields are encrypted into / decrypted from `enc_payload`.
function encrypt<T>(payload: T): Promise<string> {
  return encryptJSON(payload, getDEK());
}

function decrypt<T>(payload: string): Promise<T> {
  return decryptJSON<T>(payload, getDEK());
}

async function mapSettings(row: UserSettingsRow | null): Promise<UserSettings | null> {
  if (!row || !row.enc_payload) return null;
  const payload = await decrypt<SettingsPayload>(row.enc_payload);
  return {
    userId: row.user_id,
    monthlyIncome: payload.monthlyIncome,
    monthlyBudget: payload.monthlyBudget,
    savingsTarget: payload.savingsTarget,
    budgetMode: payload.budgetMode ?? 'monthly',
    statementProfiles: payload.statementProfiles ?? [],
    excludeDescriptionsFromAI: payload.excludeDescriptionsFromAI ?? false,
    updatedAt: row.updated_at
  };
}

async function mapCategory(row: BudgetCategoryRow): Promise<BudgetCategory> {
  const payload = await decrypt<CategoryPayload>(row.enc_payload);
  return {
    id: row.id,
    userId: row.user_id,
    category: payload.category,
    monthlyLimit: payload.monthlyLimit,
    statementProfileId: payload.statementProfileId ?? null,
    updatedAt: row.updated_at
  };
}

async function mapExpense(row: ExpenseRow): Promise<Expense> {
  const payload = await decrypt<ExpensePayload>(row.enc_payload);
  return {
    id: row.id,
    userId: row.user_id,
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
    spentOn: payload.spentOn,
    statementProfileId: payload.statementProfileId ?? null,
    recurringId: row.recurring_id,
    createdAt: row.created_at
  };
}

async function mapRecurring(row: RecurringExpenseRow): Promise<RecurringExpense> {
  const payload = await decrypt<RecurringPayload>(row.enc_payload);
  return {
    id: row.id,
    userId: row.user_id,
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
    dayOfMonth: payload.dayOfMonth,
    statementProfileId: payload.statementProfileId ?? null,
    createdAt: row.created_at
  };
}

async function mapOneTimeIncome(row: OneTimeIncomeRow): Promise<OneTimeIncome> {
  const payload = await decrypt<OneTimeIncomePayload>(row.enc_payload);
  return {
    id: row.id,
    userId: row.user_id,
    description: payload.description,
    amount: payload.amount,
    receivedOn: payload.receivedOn,
    createdAt: row.created_at
  };
}

function requireNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// RLS already blocks cross-tenant writes, but it does so silently (Supabase
// returns `{ error: null, data: [] }`, not an error) -- an IDOR attempt
// against another user's id and a genuine bug (stale/deleted id) both look
// like a no-op success without this check. Callers must add `.select('id')`
// to the update/delete chain for this to have rows to inspect.
function requireAffectedRow(rows: { id: string }[] | null, action: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(`${action} failed: no matching row was found for this account.`);
  }
}

// Sensitive dates remain encrypted, while the structural month_key allows
// month-scoped queries. Legacy rows with no month_key are decrypted once and
// backfilled after ownership is enforced by RLS.
// Rows missing an encrypted payload are legacy/corrupt; skip them rather than
// letting one bad row break the whole decrypt.
function withPayload<T extends { enc_payload: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => Boolean(row.enc_payload));
}

async function loadAllExpenses(userId: string): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').eq('user_id', userId);
  requireNoError(error);
  return Promise.all(withPayload((data ?? []) as ExpenseRow[]).map(mapExpense));
}

async function loadMonthExpenseRows(userId: string, monthKey: string): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .or(`month_key.eq.${monthKey},month_key.is.null`);
  requireNoError(error);
  const source = withPayload((data ?? []) as ExpenseRow[]);
  const expenses = await Promise.all(source.map(mapExpense));
  await Promise.all(
    source.map((row, index) =>
      row.month_key
        ? Promise.resolve()
        : supabase
            .from('expenses')
            .update({ month_key: expenses[index].spentOn.slice(0, 7) })
            .eq('id', row.id)
            .eq('user_id', userId)
            .then(() => undefined)
    )
  );
  return source;
}

async function loadAllOneTimeIncome(userId: string): Promise<OneTimeIncome[]> {
  const { data, error } = await supabase.from('one_time_income').select('*').eq('user_id', userId);
  if (error && 'code' in error && error.code === '42P01') return [];
  requireNoError(error);
  return Promise.all(withPayload((data ?? []) as OneTimeIncomeRow[]).map(mapOneTimeIncome));
}

async function loadMonthIncome(userId: string, monthKey: string): Promise<OneTimeIncome[]> {
  const { data, error } = await supabase
    .from('one_time_income')
    .select('*')
    .eq('user_id', userId)
    .or(`month_key.eq.${monthKey},month_key.is.null`);
  if (error && 'code' in error && error.code === '42P01') return [];
  requireNoError(error);
  const source = withPayload((data ?? []) as OneTimeIncomeRow[]);
  const income = await Promise.all(source.map(mapOneTimeIncome));
  await Promise.all(
    source.map((row, index) =>
      row.month_key
        ? Promise.resolve()
        : supabase
            .from('one_time_income')
            .update({ month_key: income[index].receivedOn.slice(0, 7) })
            .eq('id', row.id)
            .eq('user_id', userId)
            .then(() => undefined)
    )
  );
  return filterAndSortIncome(income, monthKey);
}

function filterAndSortMonth(expenses: Expense[], monthKey: string): Expense[] {
  const { start, end } = monthBounds(monthKey);
  return filterAndSortExpenses(expenses, start, end);
}

function filterAndSortExpenses(expenses: Expense[], start: string, end: string): Expense[] {
  return expenses
    .filter((expense) => expense.spentOn >= start && expense.spentOn <= end)
    .sort((a, b) => {
      if (a.spentOn !== b.spentOn) return a.spentOn < b.spentOn ? 1 : -1;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
}

function filterAndSortIncome(income: OneTimeIncome[], monthKey: string): OneTimeIncome[] {
  const { start, end } = monthBounds(monthKey);
  return filterAndSortIncomeRange(income, start, end);
}

function filterAndSortIncomeRange(income: OneTimeIncome[], start: string, end: string): OneTimeIncome[] {
  return income
    .filter((item) => item.receivedOn >= start && item.receivedOn <= end)
    .sort((a, b) => {
      if (a.receivedOn !== b.receivedOn) return a.receivedOn < b.receivedOn ? 1 : -1;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
}

async function loadPeriodExpenseRows(userId: string, period: BudgetPeriod): Promise<ExpenseRow[]> {
  const groups = await Promise.all(monthKeysForRange(period.start, period.end).map((key) => loadMonthExpenseRows(userId, key)));
  return [...new Map(groups.flat().map((row) => [row.id, row])).values()];
}

async function loadPeriodIncome(userId: string, period: BudgetPeriod): Promise<OneTimeIncome[]> {
  const groups = await Promise.all(monthKeysForRange(period.start, period.end).map((key) => loadMonthIncome(userId, key)));
  return filterAndSortIncomeRange(
    [...new Map(groups.flat().map((item) => [item.id, item])).values()],
    period.start,
    period.end
  );
}

export async function loadMonthData(userId: string, monthKey: string): Promise<MonthData> {
  return loadPeriodData(userId, monthlyPeriod(monthKey));
}

export async function loadPeriodData(userId: string, period: BudgetPeriod): Promise<MonthData> {
  const [settingsResult, categoriesResult, recurringResult] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle<UserSettingsRow>(),
    supabase.from('budget_categories').select('*').eq('user_id', userId),
    supabase.from('recurring_expenses').select('*').eq('user_id', userId)
  ]);

  requireNoError(settingsResult.error);
  requireNoError(categoriesResult.error);
  requireNoError(recurringResult.error);

  const recurringExpenses = await Promise.all(
    withPayload((recurringResult.data ?? []) as RecurringExpenseRow[]).map(mapRecurring)
  );
  recurringExpenses.sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  // Expand templates for every calendar month touched by the selected period.
  await Promise.all(monthKeysForRange(period.start, period.end).map((key) => expandRecurringExpenses(userId, key, recurringExpenses)));
  const [expenseRows, allIncome] = await Promise.all([
    loadPeriodExpenseRows(userId, period),
    loadPeriodIncome(userId, period)
  ]);
  const allExpenses = await Promise.all(expenseRows.map(mapExpense));

  const categories = await Promise.all(withPayload((categoriesResult.data ?? []) as BudgetCategoryRow[]).map(mapCategory));
  categories.sort((a, b) => a.category.localeCompare(b.category));

  return {
    settings: await mapSettings(settingsResult.data),
    categories,
    expenses: filterAndSortExpenses(allExpenses, period.start, period.end).filter((expense) =>
      period.mode === 'statement' ? expense.statementProfileId === period.statementProfileId : true
    ),
    recurringExpenses,
    oneTimeIncome: filterAndSortIncomeRange(allIncome, period.start, period.end)
  };
}

export async function loadMonthExpenses(userId: string, monthKey: string): Promise<Expense[]> {
  const all = await Promise.all((await loadMonthExpenseRows(userId, monthKey)).map(mapExpense));
  return filterAndSortMonth(all, monthKey);
}

export async function loadPeriodExpenses(userId: string, period: BudgetPeriod): Promise<Expense[]> {
  const all = await Promise.all((await loadPeriodExpenseRows(userId, period)).map(mapExpense));
  return filterAndSortExpenses(all, period.start, period.end).filter((expense) =>
    period.mode === 'statement' ? expense.statementProfileId === period.statementProfileId : true
  );
}

export async function saveSettings(userId: string, input: Omit<UserSettings, 'userId' | 'updatedAt'>): Promise<void> {
  const enc_payload = await encrypt<SettingsPayload>({
    monthlyIncome: input.monthlyIncome,
    monthlyBudget: input.monthlyBudget,
    savingsTarget: input.savingsTarget,
    budgetMode: input.budgetMode,
    statementProfiles: input.statementProfiles,
    excludeDescriptionsFromAI: input.excludeDescriptionsFromAI
  });
  const { error } = await supabase.from('user_settings').upsert(
    { user_id: userId, enc_payload, updated_at: nowIso() },
    { onConflict: 'user_id' }
  );
  requireNoError(error);
}

export async function saveCategoryLimit(
  userId: string,
  category: Category,
  monthlyLimit: number,
  existing?: BudgetCategory,
  statementProfileId: string | null = null
): Promise<void> {
  // Category names are encrypted, so we can't rely on a unique constraint to
  // upsert; we update the existing row by id or insert a new one.
  const enc_payload = await encrypt<CategoryPayload>({ category, monthlyLimit, statementProfileId });
  if (existing) {
    const { data, error } = await supabase
      .from('budget_categories')
      .update({ enc_payload, updated_at: nowIso() })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('id');
    requireNoError(error);
    requireAffectedRow(data, 'Updating this category');
    return;
  }
  const { error } = await supabase
    .from('budget_categories')
    .insert({ id: id(), user_id: userId, enc_payload, updated_at: nowIso() });
  requireNoError(error);
}

export async function createExpense(userId: string, draft: ExpenseDraft): Promise<void> {
  const enc_payload = await encrypt<ExpensePayload>({
    description: draft.description.trim(),
    amount: draft.amount,
    category: draft.category,
    spentOn: draft.spentOn,
    statementProfileId: draft.statementProfileId ?? null
  });
  const { error } = await supabase.from('expenses').insert({
    id: id(),
    user_id: userId,
    recurring_id: draft.recurringId ?? null,
    month_key: draft.spentOn.slice(0, 7),
    enc_payload,
    created_at: nowIso()
  });
  requireNoError(error);
}

export async function updateExpense(userId: string, expenseId: string, draft: ExpenseDraft): Promise<void> {
  const enc_payload = await encrypt<ExpensePayload>({
    description: draft.description.trim(),
    amount: draft.amount,
    category: draft.category,
    spentOn: draft.spentOn,
    statementProfileId: draft.statementProfileId ?? null
  });
  const { data, error } = await supabase
    .from('expenses')
    .update({ enc_payload, month_key: draft.spentOn.slice(0, 7) })
    .eq('id', expenseId)
    .eq('user_id', userId)
    .select('id');
  requireNoError(error);
  requireAffectedRow(data, 'Updating this expense');
}

export async function deleteExpense(userId: string, expenseId: string): Promise<void> {
  const { data, error } = await supabase.from('expenses').delete().eq('id', expenseId).eq('user_id', userId).select('id');
  requireNoError(error);
  requireAffectedRow(data, 'Deleting this expense');
}

export async function createRecurringExpense(userId: string, draft: RecurringDraft): Promise<void> {
  const enc_payload = await encrypt<RecurringPayload>({
    description: draft.description.trim(),
    amount: draft.amount,
    category: draft.category,
    dayOfMonth: draft.dayOfMonth,
    statementProfileId: draft.statementProfileId ?? null
  });
  const { error } = await supabase.from('recurring_expenses').insert({
    id: id(),
    user_id: userId,
    enc_payload,
    created_at: nowIso()
  });
  requireNoError(error);
}

export async function deleteRecurringExpense(userId: string, recurringId: string): Promise<void> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', recurringId)
    .eq('user_id', userId)
    .select('id');
  requireNoError(error);
  requireAffectedRow(data, 'Deleting this recurring expense');
}

export async function createOneTimeIncome(userId: string, draft: OneTimeIncomeDraft): Promise<void> {
  const enc_payload = await encrypt<OneTimeIncomePayload>({
    description: draft.description.trim(),
    amount: draft.amount,
    receivedOn: draft.receivedOn
  });
  const { error } = await supabase.from('one_time_income').insert({
    id: id(),
    user_id: userId,
    month_key: draft.receivedOn.slice(0, 7),
    enc_payload,
    created_at: nowIso()
  });
  requireNoError(error);
}

export async function updateOneTimeIncome(userId: string, incomeId: string, draft: OneTimeIncomeDraft): Promise<void> {
  const enc_payload = await encrypt<OneTimeIncomePayload>({
    description: draft.description.trim(),
    amount: draft.amount,
    receivedOn: draft.receivedOn
  });
  const { data, error } = await supabase
    .from('one_time_income')
    .update({ enc_payload, month_key: draft.receivedOn.slice(0, 7) })
    .eq('id', incomeId)
    .eq('user_id', userId)
    .select('id');
  requireNoError(error);
  requireAffectedRow(data, 'Updating this income entry');
}

export async function deleteOneTimeIncome(userId: string, incomeId: string): Promise<void> {
  const { data, error } = await supabase
    .from('one_time_income')
    .delete()
    .eq('id', incomeId)
    .eq('user_id', userId)
    .select('id');
  requireNoError(error);
  requireAffectedRow(data, 'Deleting this income entry');
}

// Inserts a concrete expense for each recurring template not yet present this
// month. `recurring` may be passed in to avoid an extra fetch+decrypt.
export async function expandRecurringExpenses(
  userId: string,
  monthKey: string,
  recurring?: RecurringExpense[]
): Promise<void> {
  const recurringExpenses =
    recurring ??
    (await Promise.all(
      withPayload(
        ((await supabase.from('recurring_expenses').select('*').eq('user_id', userId)).data ?? []) as RecurringExpenseRow[]
      ).map(mapRecurring)
    ));
  if (recurringExpenses.length === 0) return;

  const monthExpenses = filterAndSortMonth(
    await Promise.all((await loadMonthExpenseRows(userId, monthKey)).map(mapExpense)),
    monthKey
  );
  const existingIds = new Set(monthExpenses.map((expense) => expense.recurringId).filter(Boolean) as string[]);

  const missing = recurringExpenses.filter((row) => !existingIds.has(row.id));
  if (missing.length === 0) return;

  const rows = await Promise.all(
    missing.map(async (row) => ({
      id: id(),
      user_id: userId,
      recurring_id: row.id,
      month_key: monthKey,
      enc_payload: await encrypt<ExpensePayload>({
        description: row.description,
        amount: row.amount,
        category: row.category,
        spentOn: dateForMonthDay(monthKey, row.dayOfMonth),
        statementProfileId: row.statementProfileId
      }),
      created_at: nowIso()
    }))
  );

  const { error } = await supabase
    .from('expenses')
    .upsert(rows, { onConflict: 'user_id,recurring_id,month_key', ignoreDuplicates: true });
  requireNoError(error);
}

// Export decrypts everything into a portable payload used to build the Excel
// workbook. The downloaded workbook is plaintext and is not encrypted.
export async function exportAllData(userId: string): Promise<Record<string, unknown>> {
  const [settingsResult, categoriesResult, recurringResult, incomeResult] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle<UserSettingsRow>(),
    supabase.from('budget_categories').select('*').eq('user_id', userId),
    supabase.from('recurring_expenses').select('*').eq('user_id', userId),
    supabase.from('one_time_income').select('*').eq('user_id', userId)
  ]);
  requireNoError(settingsResult.error);
  requireNoError(categoriesResult.error);
  requireNoError(recurringResult.error);
  if (incomeResult.error && (!('code' in incomeResult.error) || incomeResult.error.code !== '42P01')) {
    requireNoError(incomeResult.error);
  }

  const [settings, categories, recurringExpenses, expenses, oneTimeIncome] = await Promise.all([
    mapSettings(settingsResult.data),
    Promise.all(withPayload((categoriesResult.data ?? []) as BudgetCategoryRow[]).map(mapCategory)),
    Promise.all(withPayload((recurringResult.data ?? []) as RecurringExpenseRow[]).map(mapRecurring)),
    loadAllExpenses(userId),
    Promise.all(withPayload((incomeResult.data ?? []) as OneTimeIncomeRow[]).map(mapOneTimeIncome))
  ]);

  return {
    exported_at: nowIso(),
    user_settings: settings ? [settings] : [],
    statement_profiles: settings?.statementProfiles ?? [],
    budget_categories: categories,
    expenses,
    recurring_expenses: recurringExpenses,
    one_time_income: oneTimeIncome
  };
}

type ExportedSettings = Partial<UserSettings> & {
  monthly_income?: number | string;
  monthly_budget?: number | string;
  savings_target?: number | string;
};

export async function importData(userId: string, payload: Record<string, unknown>): Promise<void> {
  const settings = Array.isArray(payload.user_settings) ? (payload.user_settings as ExportedSettings[]) : [];
  const categories = Array.isArray(payload.budget_categories) ? (payload.budget_categories as any[]) : [];
  const expenses = Array.isArray(payload.expenses) ? (payload.expenses as any[]) : [];
  const recurring = Array.isArray(payload.recurring_expenses) ? (payload.recurring_expenses as any[]) : [];
  const oneTimeIncome = Array.isArray(payload.one_time_income) ? (payload.one_time_income as any[]) : [];
  const exportedProfiles = Array.isArray(payload.statement_profiles) ? (payload.statement_profiles as any[]) : [];

  const num = (a: unknown, b: unknown): number => Number(a ?? b ?? 0) || 0;

  if (settings[0]) {
    const s = settings[0];
    await saveSettings(userId, {
      monthlyIncome: num(s.monthlyIncome, s.monthly_income),
      monthlyBudget: num(s.monthlyBudget, s.monthly_budget),
      savingsTarget: num(s.savingsTarget, s.savings_target),
      budgetMode: s.budgetMode === 'statement' ? 'statement' : 'monthly',
      excludeDescriptionsFromAI: s.excludeDescriptionsFromAI ?? false,
      statementProfiles: (Array.isArray(s.statementProfiles) ? s.statementProfiles : exportedProfiles).map((profile) => ({
            id: String(profile.id || id()),
            name: String(profile.name || 'Statement profile'),
            closingDay: Math.min(31, Math.max(1, Number(profile.closingDay) || 1)),
            statementBudget: num(profile.statementBudget, undefined),
            archivedAt: typeof profile.archivedAt === 'string' ? profile.archivedAt : null
          }))
    });
  }

  for (const category of categories) {
    await saveCategoryLimit(
      userId,
      category.category,
      num(category.monthlyLimit, category.monthly_limit),
      undefined,
      category.statementProfileId ?? null
    );
  }

  for (const row of recurring) {
    await createRecurringExpense(userId, {
      description: row.description,
      amount: num(row.amount, undefined),
      category: row.category,
      dayOfMonth: Number(row.dayOfMonth ?? row.day_of_month ?? 1),
      statementProfileId: row.statementProfileId ?? null
    });
  }

  for (const row of expenses) {
    // Skip recurring-generated rows; they are recreated by expansion.
    if (row.recurringId ?? row.recurring_id) continue;
    await createExpense(userId, {
      description: row.description,
      amount: num(row.amount, undefined),
      category: row.category,
      spentOn: row.spentOn ?? row.spent_on,
      statementProfileId: row.statementProfileId ?? null
    });
  }

  for (const row of oneTimeIncome) {
    await createOneTimeIncome(userId, {
      description: row.description,
      amount: num(row.amount, undefined),
      receivedOn: row.receivedOn ?? row.received_on
    });
  }
}
