import { describe, expect, it } from 'vitest';
import { autoAllocateCategoryBudgets } from './autoAllocate';
import { Expense, RecurringExpense, UserSettings } from './types';

const settings: UserSettings = {
  userId: 'u1',
  monthlyIncome: 4000,
  monthlyBudget: 1000,
  savingsTarget: 100,
  budgetMode: 'monthly',
  statementProfiles: [],
  excludeDescriptionsFromAI: false,
  updatedAt: null
};

function expense(id: string, category: Expense['category'], amount: number): Expense {
  return {
    id,
    userId: 'u1',
    description: id,
    amount,
    category,
    spentOn: '2026-05-01',
    statementProfileId: null,
    recurringId: null,
    createdAt: null
  };
}

describe('auto allocation', () => {
  it('allocates spendable budget across categories using historical averages', () => {
    const allocations = autoAllocateCategoryBudgets({
      settings,
      monthlyExpenseSets: [
        [expense('gas-1', 'Gas', 100), expense('food-1', 'Groceries', 300)],
        [expense('gas-2', 'Gas', 200), expense('food-2', 'Groceries', 300)]
      ],
      recurringExpenses: []
    });

    const total = allocations.reduce((sum, item) => sum + item.recommendedLimit, 0);
    const groceries = allocations.find((item) => item.category === 'Groceries');
    const gas = allocations.find((item) => item.category === 'Gas');

    expect(total).toBe(1000);
    expect(groceries?.recommendedLimit).toBeGreaterThan(gas?.recommendedLimit ?? 0);
  });

  it('uses recurring templates as a baseline when history is empty', () => {
    const recurring: RecurringExpense[] = [
      {
        id: 'r1',
        userId: 'u1',
        description: 'Phone',
        amount: 120,
        category: 'Subscriptions',
        dayOfMonth: 2,
        statementProfileId: null,
        createdAt: null
      }
    ];
    const allocations = autoAllocateCategoryBudgets({ settings, monthlyExpenseSets: [], recurringExpenses: recurring });
    const subscriptions = allocations.find((item) => item.category === 'Subscriptions');

    expect(subscriptions?.recommendedLimit).toBe(1000);
    expect(subscriptions?.recurringBaseline).toBe(120);
  });
});
