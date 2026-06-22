import { FormEvent, useMemo, useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { CategorySummary, BudgetSummary } from '../lib/budgetMath';
import { buildChatBudgetContext, ChatMessage, sendChatMessage } from '../lib/chatContext';
import { BudgetPeriod, Expense, RecurringExpense } from '../lib/types';
import { MarkdownText } from './MarkdownText';

type Props = {
  period: BudgetPeriod;
  summary: BudgetSummary;
  categories: CategorySummary[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
};

const STARTERS = [
  'Why is my safe-to-spend low?',
  'Where am I overspending?',
  'Can I afford a $50.00 purchase today?',
  'What should I watch for the rest of the month?'
];

export function BudgetChat({ period, summary, categories, expenses, recurringExpenses }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask about this budget period’s spending. I use a free OpenRouter model, so availability can vary.'
    }
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const context = useMemo(
    () => buildChatBudgetContext({ period, summary, categories, expenses, recurringExpenses }),
    [categories, expenses, period, recurringExpenses, summary]
  );

  async function submitMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage({
        message: trimmed,
        context,
        history: messages.slice(-8)
      });
      setModel(response.model ?? null);
      setMessages([...nextMessages, { role: 'assistant', content: response.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The chat feature is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(draft);
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OpenRouter</p>
          <h2>Budget chatbot</h2>
        </div>
        <span className="coach-badge">
          <Sparkles size={15} />
          Free model
        </span>
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message, index) => (
          <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <span className="chat-avatar">{message.role === 'assistant' ? <Bot size={16} /> : 'You'}</span>
            <MarkdownText content={message.content} />
          </article>
        ))}
        {loading && (
          <article className="chat-message assistant">
            <span className="chat-avatar">
              <Bot size={16} />
            </span>
            <MarkdownText content="Thinking..." />
          </article>
        )}
      </div>

      {error && <p className="chat-error">{error}</p>}

      <div className="starter-grid">
        {STARTERS.map((starter) => (
          <button type="button" className="coach-question" key={starter} onClick={() => void submitMessage(starter)}>
            {starter}
          </button>
        ))}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          value={draft}
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about your spending..."
          aria-label="Chat message"
        />
        <button className="primary-button" type="submit" disabled={loading || !draft.trim()}>
          <Send size={17} />
          Send
        </button>
      </form>
      <small className="chat-footnote">
        Sends selected-period summaries and recent expenses only. {model ? `Last model: ${model}.` : 'Free models may rate-limit.'}
      </small>
    </section>
  );
}
