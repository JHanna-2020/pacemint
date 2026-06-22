import { CATEGORIES, Category, Expense, BudgetCategory, UserSettings, OneTimeIncome, BudgetPeriod } from './types';
import { centsToDecimal, decimalToCents } from './money';
import { addDays, daysInRange, daysRemainingInPeriod } from './date';

export type BudgetSummary = {
  income: number;
  baseIncome: number;
  oneTimeIncome: number;
  periodBudget: number;
  savingsTarget: number;
  spendable: number;
  totalSpent: number;
  remaining: number;
  daysLeft: number;
  safeDailySpend: number;
  safeWeeklySpend: number;
};

export type CategorySummary = {
  category: Category;
  spent: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isOver: boolean;
};

export type TrendPoint = {
  date: string;
  spent: number;
  cumulative: number;
};

export function calculateSummary(
  settings: UserSettings | null,
  expenses: Expense[],
  income: OneTimeIncome[],
  period: BudgetPeriod,
  statementBudget?: number,
  today = new Date()
): BudgetSummary {
  const baseIncomeCents = decimalToCents(settings?.monthlyIncome);
  const oneTimeIncomeCents = income.reduce((sum, item) => sum + decimalToCents(item.amount), 0);
  const incomeCents = baseIncomeCents + oneTimeIncomeCents;
  const budgetCents = decimalToCents(period.mode === 'statement' ? statementBudget : settings?.monthlyBudget);
  const savingsCents = decimalToCents(settings?.savingsTarget);
  // Spendable cash is total income (base + one-time) minus the savings target.
  const availableCashCents = Math.max(0, incomeCents - savingsCents);
  const spendableCents = Math.min(budgetCents, availableCashCents);
  const spentCents = expenses.reduce((sum, expense) => sum + decimalToCents(expense.amount), 0);
  const remainingCents = spendableCents - spentCents;
  const daysLeft = daysRemainingInPeriod(period.start, period.end, today);
  const safeDailyCents = daysLeft > 0 ? Math.floor(remainingCents / daysLeft) : remainingCents;

  return {
    income: centsToDecimal(incomeCents),
    baseIncome: centsToDecimal(baseIncomeCents),
    oneTimeIncome: centsToDecimal(oneTimeIncomeCents),
    periodBudget: centsToDecimal(budgetCents),
    savingsTarget: centsToDecimal(savingsCents),
    spendable: centsToDecimal(spendableCents),
    totalSpent: centsToDecimal(spentCents),
    remaining: centsToDecimal(remainingCents),
    daysLeft,
    safeDailySpend: centsToDecimal(safeDailyCents),
    safeWeeklySpend: centsToDecimal(safeDailyCents * 7)
  };
}

export function calculateCategorySummaries(
  categories: BudgetCategory[],
  expenses: Expense[]
): CategorySummary[] {
  const limits = new Map<Category, number>();
  categories.forEach((item) => limits.set(item.category, decimalToCents(item.monthlyLimit)));

  return CATEGORIES.map((category) => {
    const spentCents = expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + decimalToCents(expense.amount), 0);
    const limitCents = limits.get(category) ?? 0;
    const remainingCents = limitCents - spentCents;
    const percentUsed = limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0;

    return {
      category,
      spent: centsToDecimal(spentCents),
      limit: centsToDecimal(limitCents),
      remaining: centsToDecimal(remainingCents),
      percentUsed,
      isOver: limitCents > 0 && spentCents > limitCents
    };
  });
}

export function buildTrend(expenses: Expense[], period: BudgetPeriod): TrendPoint[] {
  const dayCount = daysInRange(period.start, period.end);
  const spentByDate = new Map<string, number>();

  expenses.forEach((expense) => {
    spentByDate.set(expense.spentOn, (spentByDate.get(expense.spentOn) ?? 0) + decimalToCents(expense.amount));
  });

  let cumulative = 0;
  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(period.start, index);
    const spent = spentByDate.get(date) ?? 0;
    cumulative += spent;
    return {
      date,
      spent: centsToDecimal(spent),
      cumulative: centsToDecimal(cumulative)
    };
  });
}
