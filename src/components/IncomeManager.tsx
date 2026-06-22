import { FormEvent, useEffect, useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { OneTimeIncome } from '../lib/types';
import { formatCurrency } from '../lib/money';

type IncomeInput = {
  description: string;
  amount: number;
  receivedOn: string;
};

type Props = {
  income: OneTimeIncome[];
  defaultDate: string;
  onCreate: (draft: IncomeInput) => Promise<void>;
  onUpdate: (incomeId: string, draft: IncomeInput) => Promise<void>;
  onDelete: (incomeId: string) => Promise<void>;
};

const blank = (defaultDate: string): IncomeInput => ({
  description: '',
  amount: 0,
  receivedOn: defaultDate
});

export function IncomeManager({ income, defaultDate, onCreate, onUpdate, onDelete }: Props) {
  const [draft, setDraft] = useState<IncomeInput>(blank(defaultDate));
  const [editing, setEditing] = useState<OneTimeIncome | null>(null);

  useEffect(() => {
    setDraft((current) => ({ ...current, receivedOn: defaultDate }));
  }, [defaultDate]);

  function edit(item: OneTimeIncome) {
    setEditing(item);
    setDraft({
      description: item.description,
      amount: item.amount,
      receivedOn: item.receivedOn
    });
  }

  function reset() {
    setEditing(null);
    setDraft(blank(defaultDate));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.description.trim() || draft.amount <= 0) return;
    if (editing) {
      await onUpdate(editing.id, draft);
    } else {
      await onCreate(draft);
    }
    reset();
  }

  async function remove(item: OneTimeIncome) {
    if (!confirm(`Delete "${item.description}" for ${formatCurrency(item.amount)}?`)) return;
    await onDelete(item.id);
  }

  return (
    <section className="panel income-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Income</p>
          <h2>One-time income</h2>
        </div>
        {editing && (
          <button className="icon-button" aria-label="Cancel income edit" onClick={reset}>
            <X size={18} />
          </button>
        )}
      </div>
      <form className="income-form" onSubmit={submit}>
        <label className="wide-field">
          Description
          <input
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Bonus, gift, freelance..."
            required
          />
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={draft.amount || ''}
            onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })}
            required
          />
        </label>
        <label>
          Date received
          <input
            type="date"
            value={draft.receivedOn}
            onChange={(event) => setDraft({ ...draft, receivedOn: event.target.value })}
            required
          />
        </label>
        <button className="primary-button form-submit" type="submit">
          <Plus size={17} />
          {editing ? 'Update' : 'Add'}
        </button>
      </form>
      <div className="mini-list">
        {income.length === 0 ? (
          <p className="empty-state">No one-time income logged for this period.</p>
        ) : (
          income.map((item) => (
            <article className="mini-row" key={item.id}>
              <div>
                <strong>{item.description}</strong>
                <small>{item.receivedOn}</small>
              </div>
              <span>{formatCurrency(item.amount)}</span>
              <button className="icon-button" aria-label="Edit income" onClick={() => edit(item)}>
                <Edit3 size={16} />
              </button>
              <button className="icon-button danger-button" aria-label="Delete income" onClick={() => remove(item)}>
                <Trash2 size={16} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
