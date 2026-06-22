import { FormEvent, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, Category, RecurringExpense, StatementProfile } from '../lib/types';
import { formatCurrency } from '../lib/money';

type Props = {
  recurring: RecurringExpense[];
  profiles: StatementProfile[];
  onCreate: (draft: { description: string; amount: number; category: Category; dayOfMonth: number; statementProfileId: string | null }) => Promise<void>;
  onDelete: (recurringId: string) => Promise<void>;
};

export function RecurringPanel({ recurring, profiles, onCreate, onDelete }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<Category>('Subscriptions');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [statementProfileId, setStatementProfileId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim() || amount <= 0) return;
    await onCreate({ description, amount, category, dayOfMonth, statementProfileId });
    setDescription('');
    setAmount(0);
  }

  async function remove(item: RecurringExpense) {
    if (!confirm(`Delete recurring "${item.description}"? Existing logged expenses stay in history.`)) return;
    await onDelete(item.id);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Automation</p>
          <h2>Recurring expenses</h2>
        </div>
      </div>
      <form className="recurring-form" onSubmit={submit}>
        <label>
          Description
          <input
            placeholder="Rent, phone, streaming..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          Statement profile
          <select value={statementProfileId ?? ''} onChange={(event) => setStatementProfileId(event.target.value || null)}>
            <option value="">Unassigned</option>
            {profiles.filter((profile) => !profile.archivedAt).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount || ''}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Day
          <input
            type="number"
            min="1"
            max="28"
            value={dayOfMonth}
            onChange={(event) => setDayOfMonth(Number(event.target.value))}
          />
        </label>
        <button className="primary-button form-submit" type="submit">
          <Plus size={17} />
          Add
        </button>
      </form>
      <div className="mini-list">
        {recurring.length === 0 ? (
          <p className="empty-state">No recurring templates yet.</p>
        ) : (
          recurring.map((item) => (
            <article key={item.id} className="mini-row">
              <div>
                <strong>{item.description}</strong>
                <small>
                  Day {item.dayOfMonth} · {item.category}
                  {item.statementProfileId ? ` · ${profiles.find((profile) => profile.id === item.statementProfileId)?.name ?? 'Statement profile'}` : ''}
                </small>
              </div>
              <span>{formatCurrency(item.amount)}</span>
              <button className="icon-button danger-button" aria-label="Delete recurring expense" onClick={() => remove(item)}>
                <Trash2 size={16} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
