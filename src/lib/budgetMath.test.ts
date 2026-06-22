import { describe, expect, it } from 'vitest';
import { calculateCategorySummaries, calculateSummary } from './budgetMath';
import { BudgetCategory, Expense, OneTimeIncome, UserSettings } from './types';
import { monthlyPeriod, statementPeriod } from './date';

const settings: UserSettings = {
  userId: 'u1',
  monthlyIncome: 5000,
  monthlyBudget: 3000,
  savingsTarget: 800,
  budgetMode: 'monthly',
  statementProfiles: [],
  updatedAt: null
};

const expenses: Expense[] = [
  {
    id: 'e1',
    userId: 'u1',
    description: 'Market',
    amount: 120.45,
    category: 'Groceries',
    spentOn: '2026-06-02',
    statementProfileId: null,
    recurringId: null,
    createdAt: null
  },
  {
    id: 'e2',
    userId: 'u1',
    description: 'Dinner',
    amount: 79.55,
    category: 'Dining Out',
    spentOn: '2026-06-04',
    statementProfileId: null,
    recurringId: null,
    createdAt: null
  }
];

const income: OneTimeIncome[] = [
  {
    id: 'i1',
    userId: 'u1',
    description: 'Bonus',
    amount: 250.25,
    receivedOn: '2026-06-05',
    createdAt: null
  }
];

describe('budget math', () => {
  it('reserves savings before calculating safe spending', () => {
    const summary = calculateSummary(settings, expenses, income, monthlyPeriod('2026-06'), undefined, new Date('2026-06-10T12:00:00'));

    expect(summary.income).toBe(5250.25);
    expect(summary.oneTimeIncome).toBe(250.25);
    expect(summary.spendable).toBe(3000);
    expect(summary.totalSpent).toBe(200);
    expect(summary.remaining).toBe(2800);
    expect(summary.daysLeft).toBe(21);
    expect(summary.safeDailySpend).toBe(133.33);
    expect(summary.safeWeeklySpend).toBe(933.31);
  });

  it('calculates category limits and overages using cents', () => {
    const categories: BudgetCategory[] = [
      {
        id: 'c1',
        userId: 'u1',
        category: 'Groceries',
        monthlyLimit: 100,
        statementProfileId: null,
        updatedAt: null
      }
    ];

    const grocery = calculateCategorySummaries(categories, expenses).find((item) => item.category === 'Groceries');

    expect(grocery?.spent).toBe(120.45);
    expect(grocery?.remaining).toBe(-20.45);
    expect(grocery?.percentUsed).toBe(120);
    expect(grocery?.isOver).toBe(true);
  });

  it('uses a statement profile budget and statement-cycle days', () => {
    const period = statementPeriod('2026-06', 15, 'profile-1');
    const summary = calculateSummary(settings, expenses, [], period, 600, new Date('2026-06-10T12:00:00'));

    expect(period.start).toBe('2026-05-16');
    expect(period.end).toBe('2026-06-15');
    expect(summary.spendable).toBe(600);
    expect(summary.daysLeft).toBe(6);
  });
});
