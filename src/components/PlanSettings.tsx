import { FormEvent, useEffect, useState } from 'react';
import { UserSettings } from '../lib/types';

type Props = {
  settings: UserSettings | null;
  onSave: (input: { monthlyIncome: number; monthlyBudget: number; savingsTarget: number }) => Promise<void>;
};

export function PlanSettings({ settings, onSave }: Props) {
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [savingsTarget, setSavingsTarget] = useState(0);

  useEffect(() => {
    setMonthlyIncome(settings?.monthlyIncome ?? 0);
    setMonthlyBudget(settings?.monthlyBudget ?? 0);
    setSavingsTarget(settings?.savingsTarget ?? 0);
  }, [settings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ monthlyIncome, monthlyBudget, savingsTarget });
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Monthly plan</p>
          <h2>Budget settings</h2>
        </div>
      </div>
      <form className="compact-form" onSubmit={submit}>
        <label>
          Income
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyIncome}
            onChange={(event) => setMonthlyIncome(Number(event.target.value))}
          />
        </label>
        <label>
          Budget
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyBudget}
            onChange={(event) => setMonthlyBudget(Number(event.target.value))}
          />
        </label>
        <label>
          Savings goal
          <input
            type="number"
            min="0"
            step="0.01"
            value={savingsTarget}
            onChange={(event) => setSavingsTarget(Number(event.target.value))}
          />
        </label>
        <button className="primary-button" type="submit">
          Save plan
        </button>
      </form>
    </section>
  );
}
