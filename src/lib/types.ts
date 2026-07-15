export const CATEGORIES = [
  'Groceries',
  'Dining Out',
  'Subscriptions',
  'Gas',
  'Personal Necessities',
  'Other'
] as const;

export type Category = (typeof CATEGORIES)[number];

export type BudgetMode = 'monthly' | 'statement';

export type StatementProfile = {
  id: string;
  name: string;
  closingDay: number;
  statementBudget: number;
  archivedAt: string | null;
};

export type BudgetPeriod = {
  mode: BudgetMode;
  anchorMonth: string;
  start: string;
  end: string;
  label: string;
  statementProfileId: string | null;
};

// Stored rows. Sensitive fields live encrypted inside `enc_payload`; only
// structural columns (ids, foreign keys, timestamps) remain plaintext so the
// relational layer and row-level-security still function.

export type UserSettingsRow = {
  user_id: string;
  enc_payload: string;
  updated_at: string | null;
};

export type BudgetCategoryRow = {
  id: string;
  user_id: string;
  enc_payload: string;
  updated_at: string | null;
};

export type ExpenseRow = {
  id: string;
  user_id: string;
  recurring_id: string | null;
  month_key: string | null;
  enc_payload: string;
  created_at: string | null;
};

export type RecurringExpenseRow = {
  id: string;
  user_id: string;
  enc_payload: string;
  created_at: string | null;
};

export type OneTimeIncomeRow = {
  id: string;
  user_id: string;
  enc_payload: string;
  month_key: string | null;
  created_at: string | null;
};

// Cleartext shapes that get encrypted into `enc_payload` for each table.
export type SettingsPayload = {
  monthlyIncome: number;
  monthlyBudget: number;
  savingsTarget: number;
  budgetMode?: BudgetMode;
  statementProfiles?: StatementProfile[];
  excludeDescriptionsFromAI?: boolean;
};

export type CategoryPayload = {
  category: Category;
  monthlyLimit: number;
  statementProfileId?: string | null;
};

export type ExpensePayload = {
  description: string;
  amount: number;
  category: Category;
  spentOn: string;
  statementProfileId?: string | null;
};

export type RecurringPayload = {
  description: string;
  amount: number;
  category: Category;
  dayOfMonth: number;
  statementProfileId?: string | null;
};

export type OneTimeIncomePayload = {
  description: string;
  amount: number;
  receivedOn: string;
};

export type UserSettings = {
  userId: string;
  monthlyIncome: number;
  monthlyBudget: number;
  savingsTarget: number;
  budgetMode: BudgetMode;
  statementProfiles: StatementProfile[];
  excludeDescriptionsFromAI: boolean;
  updatedAt: string | null;
};

export type BudgetCategory = {
  id: string;
  userId: string;
  category: Category;
  monthlyLimit: number;
  statementProfileId: string | null;
  updatedAt: string | null;
};

export type Expense = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  category: Category;
  spentOn: string;
  statementProfileId: string | null;
  recurringId: string | null;
  createdAt: string | null;
};

export type RecurringExpense = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  category: Category;
  dayOfMonth: number;
  statementProfileId: string | null;
  createdAt: string | null;
};

export type OneTimeIncome = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  receivedOn: string;
  createdAt: string | null;
};

export type MonthData = {
  settings: UserSettings | null;
  categories: BudgetCategory[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  oneTimeIncome: OneTimeIncome[];
};

export type ExpenseDraft = {
  description: string;
  amount: number;
  category: Category;
  spentOn: string;
  statementProfileId?: string | null;
  recurringId?: string | null;
};

export type RecurringDraft = {
  description: string;
  amount: number;
  category: Category;
  dayOfMonth: number;
  statementProfileId?: string | null;
};

export type OneTimeIncomeDraft = {
  description: string;
  amount: number;
  receivedOn: string;
};
