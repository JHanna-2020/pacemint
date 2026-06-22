import { describe, expect, it } from 'vitest';
import { buildBudgetWorkbook } from './excelExport';

describe('Excel budget export', () => {
  it('creates readable workbook sheets and preserves numeric transaction amounts', () => {
    const workbook = buildBudgetWorkbook({
      exported_at: '2026-06-19T12:00:00.000Z',
      statement_profiles: [{ name: 'Main card', closingDay: 15, statementBudget: 900 }],
      expenses: [{ description: 'Groceries', amount: 42.5, category: 'Groceries', spentOn: '2026-06-18' }]
    });

    expect(workbook.map((sheet) => sheet.sheet)).toEqual([
      'Overview',
      'Settings',
      'Statement Profiles',
      'Transactions',
      'Category Budgets',
      'Recurring Expenses',
      'One-Time Income'
    ]);
    expect(workbook[3].data[1][0]).toBe('Groceries');
    expect(workbook[3].data[1][1]).toMatchObject({ value: 42.5, format: '$#,##0.00' });
    expect(workbook[2].data[1][0]).toBe('Main card');
  });
});
