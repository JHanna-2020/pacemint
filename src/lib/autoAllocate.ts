import { CATEGORIES, Category, Expense, RecurringExpense, UserSettings } from './types';
import { centsToDecimal, decimalToCents } from './money';

export type CategoryAllocation = {
  category: Category;
  recommendedLimit: number;
  averageSpend: number;
  recurringBaseline: number;
};

export function autoAllocateCategoryBudgets(input: {
  settings: UserSettings | null;
  monthlyExpenseSets: Expense[][];
  recurringExpenses: RecurringExpense[];
  budgetCap?: number;
}): CategoryAllocation[] {
  const cashAvailableCents = Math.max(
    0,
    decimalToCents(input.settings?.monthlyIncome) - decimalToCents(input.settings?.savingsTarget)
  );
  const configuredCapCents = decimalToCents(input.budgetCap ?? input.settings?.monthlyBudget);
  const spendableCents = Math.min(cashAvailableCents, configuredCapCents);
  const monthCount = Math.max(input.monthlyExpenseSets.length, 1);
  const recurringByCategory = new Map<Category, number>();
  const spentByCategory = new Map<Category, number>();

  input.recurringExpenses.forEach((expense) => {
    recurringByCategory.set(
      expense.category,
      (recurringByCategory.get(expense.category) ?? 0) + decimalToCents(expense.amount)
    );
  });

  input.monthlyExpenseSets.flat().forEach((expense) => {
    spentByCategory.set(expense.category, (spentByCategory.get(expense.category) ?? 0) + decimalToCents(expense.amount));
  });

  const weights = CATEGORIES.map((category) => {
    const averageSpendCents = Math.round((spentByCategory.get(category) ?? 0) / monthCount);
    const recurringBaselineCents = recurringByCategory.get(category) ?? 0;
    return {
      category,
      averageSpendCents,
      recurringBaselineCents,
      weightCents: Math.max(averageSpendCents, recurringBaselineCents)
    };
  });

  const totalWeightCents = weights.reduce((sum, item) => sum + item.weightCents, 0);
  const effectiveWeights =
    totalWeightCents > 0
      ? weights
      : weights.map((item) => ({
          ...item,
          weightCents: 1
        }));
  const effectiveTotal = effectiveWeights.reduce((sum, item) => sum + item.weightCents, 0);

  let allocatedCents = 0;
  const allocations = effectiveWeights.map((item, index) => {
    const recommendedLimitCents =
      index === effectiveWeights.length - 1
        ? spendableCents - allocatedCents
        : Math.round((spendableCents * item.weightCents) / effectiveTotal);
    allocatedCents += recommendedLimitCents;

    return {
      category: item.category,
      recommendedLimit: centsToDecimal(Math.max(0, recommendedLimitCents)),
      averageSpend: centsToDecimal(item.averageSpendCents),
      recurringBaseline: centsToDecimal(item.recurringBaselineCents)
    };
  });

  return allocations;
}
