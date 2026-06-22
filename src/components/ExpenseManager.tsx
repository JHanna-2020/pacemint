import { FormEvent, useEffect, useRef, useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { CATEGORIES, Category, Expense, StatementProfile } from '../lib/types';
import { formatCurrency } from '../lib/money';

type ExpenseInput = {
  description: string;
  amount: number;
  category: Category;
  spentOn: string;
  statementProfileId: string | null;
  recurringId: string | null;
};

type Props = {
  expenses: Expense[];
  defaultDate: string;
  profiles: StatementProfile[];
  defaultProfileId: string | null;
  onCreate: (draft: ExpenseInput) => Promise<void>;
  onUpdate: (expenseId: string, draft: ExpenseInput) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
};

const blank = (defaultDate: string, defaultProfileId: string | null): ExpenseInput => ({
  description: '',
  amount: 0,
  category: 'Groceries',
  spentOn: defaultDate,
  statementProfileId: defaultProfileId,
  recurringId: null
});

export function ExpenseManager({ expenses, defaultDate, profiles, defaultProfileId, onCreate, onUpdate, onDelete }: Props) {
  const activeProfiles = profiles.filter((profile) => !profile.archivedAt);
  const [draft, setDraft] = useState<ExpenseInput>(blank(defaultDate, defaultProfileId));
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editDraft, setEditDraft] = useState<ExpenseInput>(blank(defaultDate, defaultProfileId));
  const editDescriptionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft((current) => ({ ...current, spentOn: defaultDate, statementProfileId: defaultProfileId }));
  }, [defaultDate, defaultProfileId]);

  useEffect(() => {
    if (!editing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => editDescriptionRef.current?.focus());
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [editing]);

  function edit(expense: Expense) {
    setEditing(expense);
    setEditDraft({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      spentOn: expense.spentOn,
      statementProfileId: expense.statementProfileId,
      recurringId: expense.recurringId
    });
  }

  function closeEdit() {
    setEditing(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.description.trim() || draft.amount <= 0) return;
    await onCreate(draft);
    setDraft(blank(defaultDate, defaultProfileId));
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editDraft.description.trim() || editDraft.amount <= 0) return;
    await onUpdate(editing.id, editDraft);
    closeEdit();
  }

  async function remove(expense: Expense) {
    if (!confirm(`Delete "${expense.description}" for ${formatCurrency(expense.amount)}?`)) return;
    await onDelete(expense.id);
  }

  return (
    <section className="panel expense-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Transactions</p>
          <h2>Expenses</h2>
        </div>
      </div>
      <form className="expense-form" onSubmit={submit}>
        <label className="wide-field">
          Description
          <input
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Coffee, rent, groceries..."
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
          Category
          <select
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Statement profile
          <select value={draft.statementProfileId ?? ''} onChange={(event) => setDraft({ ...draft, statementProfileId: event.target.value || null })}>
            <option value="">Unassigned</option>
            {activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={draft.spentOn}
            onChange={(event) => setDraft({ ...draft, spentOn: event.target.value })}
            required
          />
        </label>
        <button className="primary-button form-submit" type="submit">
          <Plus size={17} />
          Add
        </button>
      </form>
      <div className="expense-list">
        {expenses.length === 0 ? (
          <p className="empty-state">No expenses logged for this period.</p>
        ) : (
          expenses.map((expense) => (
            <article className="expense-row" key={expense.id}>
              <div>
                <strong>{expense.description}</strong>
                <small>
                  {expense.spentOn} · {expense.category}
                  {expense.statementProfileId ? ` · ${profiles.find((profile) => profile.id === expense.statementProfileId)?.name ?? 'Statement profile'}` : ''}
                  {expense.recurringId ? ' · recurring' : ''}
                </small>
              </div>
              <span>{formatCurrency(expense.amount)}</span>
              <button
                className="icon-button"
                type="button"
                aria-label={`Edit ${expense.description}`}
                onClick={() => edit(expense)}
              >
                <Edit3 size={16} />
              </button>
              <button
                className="icon-button danger-button"
                type="button"
                aria-label={`Delete ${expense.description}`}
                onClick={() => remove(expense)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))
        )}
      </div>
      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeEdit}>
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-transaction-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="transaction-modal-heading">
              <div>
                <p className="eyebrow">Transaction</p>
                <h2 id="edit-transaction-title">Edit transaction</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close edit transaction" onClick={closeEdit}>
                <X size={18} />
              </button>
            </div>
            <form className="transaction-edit-form" onSubmit={submitEdit}>
              <label>
                Description
                <input
                  ref={editDescriptionRef}
                  value={editDraft.description}
                  onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                  required
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editDraft.amount || ''}
                  onChange={(event) => setEditDraft({ ...editDraft, amount: Number(event.target.value) })}
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={editDraft.category}
                  onChange={(event) => setEditDraft({ ...editDraft, category: event.target.value as Category })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Statement profile
                <select value={editDraft.statementProfileId ?? ''} onChange={(event) => setEditDraft({ ...editDraft, statementProfileId: event.target.value || null })}>
                  <option value="">Unassigned</option>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}{profile.archivedAt ? ' (archived)' : ''}</option>)}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={editDraft.spentOn}
                  onChange={(event) => setEditDraft({ ...editDraft, spentOn: event.target.value })}
                  required
                />
              </label>
              <div className="transaction-modal-actions">
                <button className="secondary-button" type="button" onClick={closeEdit}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  <Edit3 size={17} />
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
