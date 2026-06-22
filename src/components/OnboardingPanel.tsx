import { FormEvent, useState } from 'react';
import { ArrowRight, PiggyBank } from 'lucide-react';

type Props = {
  onSave: (input: { monthlyIncome: number; monthlyBudget: number; savingsTarget: number }) => Promise<void>;
};

export function OnboardingPanel({ onSave }: Props) {
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [savingsTarget, setSavingsTarget] = useState(0);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ monthlyIncome, monthlyBudget, savingsTarget });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="onboarding-panel">
      <div className="onboarding-copy">
        <span className="metric-icon">
          <PiggyBank size={19} />
        </span>
        <p className="eyebrow">First month setup</p>
        <h1>Start with the numbers that shape every decision.</h1>
        <p>
          Set your income, monthly spending budget, and savings target. PaceMint will reserve savings first and turn
          the rest into a safe-to-spend pace.
        </p>
      </div>
      <form className="onboarding-form" onSubmit={submit}>
        <label>
          Monthly income
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyIncome || ''}
            onChange={(event) => setMonthlyIncome(Number(event.target.value))}
            required
          />
        </label>
        <label>
          Monthly budget
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyBudget || ''}
            onChange={(event) => setMonthlyBudget(Number(event.target.value))}
            required
          />
        </label>
        <label>
          Savings target
          <input
            type="number"
            min="0"
            step="0.01"
            value={savingsTarget || ''}
            onChange={(event) => setSavingsTarget(Number(event.target.value))}
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Create my plan'}
          <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}
