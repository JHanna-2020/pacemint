import { BudgetSummary, CategorySummary } from './budgetMath';
import { BudgetPeriod, Expense, RecurringExpense } from './types';
import { supabase } from './supabase';

export type ChatBudgetContext = {
  period: Pick<BudgetPeriod, 'mode' | 'start' | 'end' | 'label'>;
  summary: BudgetSummary;
  categories: CategorySummary[];
  recurringTotal: number;
  recentExpenses: Array<Pick<Expense, 'description' | 'amount' | 'category' | 'spentOn' | 'recurringId'>>;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function buildChatBudgetContext(input: {
  period: BudgetPeriod;
  summary: BudgetSummary;
  categories: CategorySummary[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
}): ChatBudgetContext {
  return {
    period: {
      mode: input.period.mode,
      start: input.period.start,
      end: input.period.end,
      label: input.period.label
    },
    summary: input.summary,
    categories: input.categories,
    recurringTotal: input.recurringExpenses.reduce((sum, item) => sum + item.amount, 0),
    recentExpenses: input.expenses.slice(0, 20).map((expense) => ({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      spentOn: expense.spentOn,
      recurringId: expense.recurringId
    }))
  };
}

export async function sendChatMessage(input: {
  message: string;
  context: ChatBudgetContext;
  history: ChatMessage[];
}): Promise<{ answer: string; model?: string }> {
  const endpoint =
    import.meta.env.VITE_CHAT_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001/api/chat'
      : '/api/chat');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sign in again to use the AI chat.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });
  const data = (await response.json()) as { answer?: string; model?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? 'The AI chat service is unavailable.');
  }

  return {
    answer: data.answer ?? 'No answer returned.',
    model: data.model
  };
}
