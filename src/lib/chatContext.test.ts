import { describe, expect, it } from 'vitest';
import { buildChatBudgetContext } from './chatContext';
import { Expense, RecurringExpense } from './types';
import { monthlyPeriod } from './date';

const expense = (index: number): Expense => ({
  id: String(index),
  userId: 'u1',
  description: `Expense ${index}`,
  amount: index,
  category: 'Groceries',
  spentOn: '2026-06-01',
  statementProfileId: null,
  recurringId: null,
  createdAt: null
});

describe('chat context', () => {
  it('only sends recent selected-month expenses', () => {
    const context = buildChatBudgetContext({
      period: monthlyPeriod('2026-06'),
      summary: {
        income: 0,
        baseIncome: 0,
        oneTimeIncome: 0,
        periodBudget: 1000,
        savingsTarget: 100,
        spendable: 900,
        totalSpent: 200,
        remaining: 700,
        daysLeft: 20,
        safeDailySpend: 35,
        safeWeeklySpend: 245
      },
      categories: [],
      expenses: Array.from({ length: 25 }, (_, index) => expense(index)),
      recurringExpenses: [
        {
          id: 'r1',
          userId: 'u1',
          description: 'Phone',
          amount: 50,
          category: 'Subscriptions',
          dayOfMonth: 1,
          statementProfileId: null,
          createdAt: null
        } satisfies RecurringExpense
      ]
    });

    expect(context.recentExpenses).toHaveLength(20);
    expect(context.recurringTotal).toBe(50);
    expect(context.recentExpenses[0]).not.toHaveProperty('userId');
  });
});
