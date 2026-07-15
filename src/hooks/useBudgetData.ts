import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { calculateCategorySummaries, calculateSummary, buildTrend } from '../lib/budgetMath';
import {
  currentStatementAnchor,
  monthlyPeriod,
  shiftMonth,
  statementPeriod,
  toMonthKey
} from '../lib/date';
import { autoAllocateCategoryBudgets, CategoryAllocation } from '../lib/autoAllocate';
import { BudgetMode, Category, Expense, MonthData, StatementProfile, UserSettings } from '../lib/types';
import * as repo from '../services/budgetRepository';

const emptyData: MonthData = {
  settings: null,
  categories: [],
  expenses: [],
  recurringExpenses: [],
  oneTimeIncome: []
};

export function useBudgetData(session: Session | null, vaultUnlocked: boolean) {
  const [data, setData] = useState<MonthData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setModeState] = useState<BudgetMode>('monthly');
  const [anchorMonth, setAnchorMonth] = useState(toMonthKey());
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null);
  const initializedForUser = useRef<string | null>(null);
  const refreshRequest = useRef(0);

  const userId = session?.user.id ?? null;
  const profiles = data.settings?.statementProfiles ?? [];
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const period = useMemo(
    () =>
      mode === 'statement' && selectedProfile
        ? statementPeriod(anchorMonth, selectedProfile.closingDay, selectedProfile.id)
        : monthlyPeriod(anchorMonth),
    [anchorMonth, mode, selectedProfile?.closingDay, selectedProfile?.id]
  );

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequest.current;
    if (!userId || !vaultUnlocked) {
      setData(emptyData);
      initializedForUser.current = null;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const initial = initializedForUser.current !== userId;
      const next = await repo.loadPeriodData(userId, initial ? monthlyPeriod(toMonthKey()) : period);
      if (requestId !== refreshRequest.current) return;
      setData(next);
      if (initial) {
        initializedForUser.current = userId;
        const preferredMode = next.settings?.budgetMode ?? 'monthly';
        const firstActive = next.settings?.statementProfiles.find((profile) => !profile.archivedAt) ?? null;
        setModeState(preferredMode === 'statement' && firstActive ? 'statement' : 'monthly');
        setSelectedProfileIdState(firstActive?.id ?? null);
        setAnchorMonth(firstActive && preferredMode === 'statement' ? currentStatementAnchor(firstActive.closingDay) : toMonthKey());
      }
    } catch (err) {
      if (requestId !== refreshRequest.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load budget data.');
    } finally {
      if (requestId === refreshRequest.current) setLoading(false);
    }
  }, [period, userId, vaultUnlocked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scopedCategories = useMemo(
    () =>
      data.categories.filter((category) =>
        mode === 'statement'
          ? category.statementProfileId === selectedProfile?.id
          : category.statementProfileId === null
      ),
    [data.categories, mode, selectedProfile]
  );
  const summary = useMemo(
    () => calculateSummary(data.settings, data.expenses, data.oneTimeIncome, period, selectedProfile?.statementBudget),
    [data.expenses, data.oneTimeIncome, data.settings, period, selectedProfile]
  );
  const categorySummaries = useMemo(
    () => calculateCategorySummaries(scopedCategories, data.expenses),
    [scopedCategories, data.expenses]
  );
  const trend = useMemo(() => buildTrend(data.expenses, period), [data.expenses, period]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (!userId || !vaultUnlocked) return;
      setLoading(true);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.');
      } finally {
        setLoading(false);
      }
    },
    [refresh, userId, vaultUnlocked]
  );

  const saveFullSettings = (settings: Omit<UserSettings, 'userId' | 'updatedAt'>) =>
    run(() => repo.saveSettings(userId!, settings));

  const changeMode = async (nextMode: BudgetMode) => {
    if (!data.settings) return;
    if (nextMode === 'statement' && !selectedProfile) return;
    setModeState(nextMode);
    setAnchorMonth(
      nextMode === 'statement' && selectedProfile ? currentStatementAnchor(selectedProfile.closingDay) : toMonthKey()
    );
    await saveFullSettings({ ...data.settings, budgetMode: nextMode });
  };

  const selectProfile = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setSelectedProfileIdState(profileId);
    setAnchorMonth(currentStatementAnchor(profile.closingDay));
  };

  const saveStatementProfiles = async (statementProfiles: StatementProfile[]) => {
    await saveFullSettings({
      monthlyIncome: data.settings?.monthlyIncome ?? 0,
      monthlyBudget: data.settings?.monthlyBudget ?? 0,
      savingsTarget: data.settings?.savingsTarget ?? 0,
      budgetMode: data.settings?.budgetMode ?? mode,
      statementProfiles,
      excludeDescriptionsFromAI: data.settings?.excludeDescriptionsFromAI ?? false
    });
    if (!statementProfiles.some((profile) => profile.id === selectedProfileId)) {
      const next = statementProfiles.find((profile) => !profile.archivedAt) ?? statementProfiles[0] ?? null;
      setSelectedProfileIdState(next?.id ?? null);
      if (next) setAnchorMonth(currentStatementAnchor(next.closingDay));
    }
  };

  return {
    data,
    loading,
    error,
    summary,
    categorySummaries,
    trend,
    period,
    mode,
    profiles,
    selectedProfile,
    refresh,
    changeMode,
    selectProfile,
    shiftPeriod: (delta: number) => setAnchorMonth((current) => shiftMonth(current, delta)),
    setMonthlyAnchor: setAnchorMonth,
    saveSettings: (input: { monthlyIncome: number; monthlyBudget: number; savingsTarget: number }) =>
      saveFullSettings({
        ...input,
        budgetMode: data.settings?.budgetMode ?? mode,
        statementProfiles: data.settings?.statementProfiles ?? [],
        excludeDescriptionsFromAI: data.settings?.excludeDescriptionsFromAI ?? false
      }),
    setExcludeDescriptionsFromAI: (value: boolean) =>
      saveFullSettings({
        monthlyIncome: data.settings?.monthlyIncome ?? 0,
        monthlyBudget: data.settings?.monthlyBudget ?? 0,
        savingsTarget: data.settings?.savingsTarget ?? 0,
        budgetMode: data.settings?.budgetMode ?? mode,
        statementProfiles: data.settings?.statementProfiles ?? [],
        excludeDescriptionsFromAI: value
      }),
    saveStatementProfiles,
    saveCategoryLimit: (category: Category, monthlyLimit: number) =>
      run(() =>
        repo.saveCategoryLimit(
          userId!,
          category,
          monthlyLimit,
          scopedCategories.find((item) => item.category === category),
          mode === 'statement' ? selectedProfile?.id ?? null : null
        )
      ),
    generateCategoryAllocation: async (): Promise<CategoryAllocation[]> => {
      if (!userId) return [];
      const periods = [1, 2, 3].map((offset) => {
        const anchor = shiftMonth(period.anchorMonth, -offset);
        return mode === 'statement' && selectedProfile
          ? statementPeriod(anchor, selectedProfile.closingDay, selectedProfile.id)
          : monthlyPeriod(anchor);
      });
      const expenseSets = await Promise.all(periods.map((item) => repo.loadPeriodExpenses(userId, item)));
      return autoAllocateCategoryBudgets({
        settings: data.settings,
        monthlyExpenseSets: expenseSets,
        recurringExpenses: data.recurringExpenses.filter((item) =>
          mode === 'statement' ? item.statementProfileId === selectedProfile?.id : true
        ),
        budgetCap: mode === 'statement' ? selectedProfile?.statementBudget : data.settings?.monthlyBudget
      });
    },
    applyCategoryAllocation: (allocations: CategoryAllocation[]) =>
      run(async () => {
        await Promise.all(
          allocations.map((allocation) =>
            repo.saveCategoryLimit(
              userId!,
              allocation.category,
              allocation.recommendedLimit,
              scopedCategories.find((item) => item.category === allocation.category),
              mode === 'statement' ? selectedProfile?.id ?? null : null
            )
          )
        );
      }),
    createExpense: (draft: Omit<Expense, 'id' | 'userId' | 'createdAt'>) => run(() => repo.createExpense(userId!, draft)),
    updateExpense: (expenseId: string, draft: Omit<Expense, 'id' | 'userId' | 'createdAt'>) =>
      run(() => repo.updateExpense(userId!, expenseId, draft)),
    deleteExpense: (expenseId: string) => run(() => repo.deleteExpense(userId!, expenseId)),
    createOneTimeIncome: (draft: { description: string; amount: number; receivedOn: string }) =>
      run(() => repo.createOneTimeIncome(userId!, draft)),
    updateOneTimeIncome: (incomeId: string, draft: { description: string; amount: number; receivedOn: string }) =>
      run(() => repo.updateOneTimeIncome(userId!, incomeId, draft)),
    deleteOneTimeIncome: (incomeId: string) => run(() => repo.deleteOneTimeIncome(userId!, incomeId)),
    createRecurringExpense: (draft: {
      description: string;
      amount: number;
      category: Category;
      dayOfMonth: number;
      statementProfileId?: string | null;
    }) => run(() => repo.createRecurringExpense(userId!, draft)),
    deleteRecurringExpense: (recurringId: string) => run(() => repo.deleteRecurringExpense(userId!, recurringId)),
    exportData: async () => (userId ? repo.exportAllData(userId) : null),
    importData: (payload: Record<string, unknown>) => run(() => repo.importData(userId!, payload))
  };
}
