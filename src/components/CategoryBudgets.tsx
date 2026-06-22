import { FormEvent, useState } from 'react';
import { Save, Wand2 } from 'lucide-react';
import { CategorySummary } from '../lib/budgetMath';
import { CategoryAllocation } from '../lib/autoAllocate';
import { categoryColor } from '../lib/categoryVisuals';
import { Category } from '../lib/types';
import { formatCompactCurrency, formatCurrency } from '../lib/money';

type Props = {
  summaries: CategorySummary[];
  onSave: (category: Category, limit: number) => Promise<void>;
  onGenerateAutoAllocation?: () => Promise<CategoryAllocation[]>;
  onApplyAutoAllocation?: (allocations: CategoryAllocation[]) => Promise<void>;
};

export function CategoryBudgets({ summaries, onSave, onGenerateAutoAllocation, onApplyAutoAllocation }: Props) {
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [allocations, setAllocations] = useState<CategoryAllocation[] | null>(null);
  const [allocating, setAllocating] = useState(false);

  async function submit(event: FormEvent, summary: CategorySummary) {
    event.preventDefault();
    await onSave(summary.category, limits[summary.category] ?? summary.limit);
  }

  async function generateAllocation() {
    if (!onGenerateAutoAllocation) return;
    setAllocating(true);
    try {
      const nextAllocations = await onGenerateAutoAllocation();
      setAllocations(nextAllocations);
      setLimits(
        Object.fromEntries(nextAllocations.map((allocation) => [allocation.category, allocation.recommendedLimit]))
      );
    } finally {
      setAllocating(false);
    }
  }

  async function applyAllocation() {
    if (!allocations || !onApplyAutoAllocation) return;
    setAllocating(true);
    try {
      await onApplyAutoAllocation(allocations);
      setAllocations(null);
    } finally {
      setAllocating(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Guardrails</p>
          <h2>Category budgets</h2>
        </div>
        {onGenerateAutoAllocation && (
          <button className="secondary-button" type="button" onClick={generateAllocation} disabled={allocating}>
            <Wand2 size={16} />
            {allocating ? 'Allocating...' : 'Auto allocate'}
          </button>
        )}
      </div>
      {allocations && (
        <div className="allocation-preview">
          <div>
            <strong>Recommended next-period limits</strong>
            <p>Based on the last three periods plus recurring templates. Applying updates your category limits.</p>
          </div>
          <div className="allocation-list">
            {allocations.map((allocation) => (
              <article key={allocation.category}>
                <span>{allocation.category}</span>
                <strong>{formatCurrency(allocation.recommendedLimit)}</strong>
                <small>
                  Avg {formatCurrency(allocation.averageSpend)} · Recurring{' '}
                  {formatCurrency(allocation.recurringBaseline)}
                </small>
              </article>
            ))}
          </div>
          <div className="allocation-actions">
            <button className="secondary-button" type="button" onClick={() => setAllocations(null)}>
              Dismiss
            </button>
            <button className="primary-button" type="button" onClick={applyAllocation} disabled={allocating}>
              Apply limits
            </button>
          </div>
        </div>
      )}
      <div className="category-stack">
        {summaries.map((summary) => {
          const fillPercent = Math.min(100, Math.max(0, summary.percentUsed));
          return (
            <form className="category-budget" key={summary.category} onSubmit={(event) => submit(event, summary)}>
              <div className="category-budget-row">
                <span>{summary.category}</span>
                <div
                  className="bar-track"
                  role="progressbar"
                  aria-label={`${summary.category} budget used`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillPercent}
                  aria-valuetext={`${summary.percentUsed}% used`}
                >
                  <div
                    className="bar-fill"
                    style={{
                      width: `${fillPercent}%`,
                      background: categoryColor(summary.category)
                    }}
                  />
                </div>
                <strong>{formatCompactCurrency(summary.spent)}</strong>
              </div>
              <div className="category-budget-meta">
                <span className={summary.isOver ? 'danger-text' : ''}>
                  Budget {formatCurrency(summary.limit)} · Remaining {formatCurrency(summary.remaining)}
                </span>
                <span className={summary.isOver ? 'danger-text' : ''}>{summary.percentUsed}% used</span>
              </div>
              <div className="category-edit">
                <input
                  aria-label={`${summary.category} monthly limit`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={limits[summary.category] ?? summary.limit}
                  onChange={(event) => setLimits({ ...limits, [summary.category]: Number(event.target.value) })}
                />
                <button className="icon-button" aria-label={`Save ${summary.category} limit`}>
                  <Save size={16} />
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}
