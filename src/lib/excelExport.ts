import type { Cell, SheetData } from 'write-excel-file/browser';

type ExportPayload = Record<string, unknown>;

type Column = {
  header: string;
  key: string;
  width: number;
  currency?: boolean;
};

export type WorkbookSheet = {
  data: SheetData;
  sheet: string;
  columns: Array<{ width: number }>;
  stickyRowsCount: number;
};

const headerCell = (value: string): Cell => ({
  value,
  fontWeight: 'bold',
  textColor: '#142027',
  backgroundColor: '#A7F3D0',
  borderColor: '#93A4AD',
  borderStyle: 'thin'
});

function rows(payload: ExportPayload, key: string): Record<string, unknown>[] {
  const value = payload[key];
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function cell(value: unknown, currency = false): Cell {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return currency ? { value, type: Number, format: '$#,##0.00' } : value;
  }
  if (typeof value === 'boolean') return value;
  return String(value);
}

function tableSheet(sheet: string, source: Record<string, unknown>[], columns: Column[]): WorkbookSheet {
  return {
    sheet,
    stickyRowsCount: 1,
    columns: columns.map(({ width }) => ({ width })),
    data: [
      columns.map(({ header }) => headerCell(header)),
      ...source.map((item) => columns.map((column) => cell(item[column.key], column.currency)))
    ]
  };
}

export function buildBudgetWorkbook(payload: ExportPayload): WorkbookSheet[] {
  const exportedAt = typeof payload.exported_at === 'string' ? payload.exported_at : new Date().toISOString();

  return [
    tableSheet('Overview', [{ label: 'Exported at', value: exportedAt }], [
      { header: 'Field', key: 'label', width: 20 },
      { header: 'Value', key: 'value', width: 30 }
    ]),
    tableSheet('Settings', rows(payload, 'user_settings'), [
      { header: 'Budget Mode', key: 'budgetMode', width: 16 },
      { header: 'Monthly Income', key: 'monthlyIncome', width: 18, currency: true },
      { header: 'Monthly Budget', key: 'monthlyBudget', width: 18, currency: true },
      { header: 'Savings Target', key: 'savingsTarget', width: 18, currency: true },
      { header: 'Updated At', key: 'updatedAt', width: 26 }
    ]),
    tableSheet('Statement Profiles', rows(payload, 'statement_profiles'), [
      { header: 'Custom Name', key: 'name', width: 24 },
      { header: 'Closing Day', key: 'closingDay', width: 14 },
      { header: 'Statement Budget', key: 'statementBudget', width: 20, currency: true },
      { header: 'Archived At', key: 'archivedAt', width: 26 }
    ]),
    tableSheet('Transactions', rows(payload, 'expenses'), [
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 14, currency: true },
      { header: 'Category', key: 'category', width: 24 },
      { header: 'Date', key: 'spentOn', width: 14 },
      { header: 'Statement Profile ID', key: 'statementProfileId', width: 38 },
      { header: 'Recurring ID', key: 'recurringId', width: 38 },
      { header: 'Created At', key: 'createdAt', width: 26 }
    ]),
    tableSheet('Category Budgets', rows(payload, 'budget_categories'), [
      { header: 'Category', key: 'category', width: 24 },
      { header: 'Monthly Limit', key: 'monthlyLimit', width: 18, currency: true },
      { header: 'Statement Profile ID', key: 'statementProfileId', width: 38 },
      { header: 'Updated At', key: 'updatedAt', width: 26 }
    ]),
    tableSheet('Recurring Expenses', rows(payload, 'recurring_expenses'), [
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 14, currency: true },
      { header: 'Category', key: 'category', width: 24 },
      { header: 'Day of Month', key: 'dayOfMonth', width: 15 },
      { header: 'Statement Profile ID', key: 'statementProfileId', width: 38 },
      { header: 'Created At', key: 'createdAt', width: 26 }
    ]),
    tableSheet('One-Time Income', rows(payload, 'one_time_income'), [
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 14, currency: true },
      { header: 'Date Received', key: 'receivedOn', width: 16 },
      { header: 'Created At', key: 'createdAt', width: 26 }
    ])
  ];
}

export async function downloadBudgetWorkbook(payload: ExportPayload): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const fileName = `pacemint-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await writeXlsxFile(buildBudgetWorkbook(payload)).toFile(fileName);
}
