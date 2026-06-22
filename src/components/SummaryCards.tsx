import { ArrowDownRight, CalendarDays, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { BudgetSummary } from '../lib/budgetMath';
import { formatCurrency } from '../lib/money';

type Props = {
  summary: BudgetSummary;
};

export function SummaryCards({ summary }: Props) {
  return (
    <section className="summary-grid">
      <article className="metric-card hero-metric">
        <span className="metric-icon">
          <Wallet size={19} />
        </span>
        <p>Safe to spend today</p>
        <strong className={summary.safeDailySpend < 0 ? 'danger-text' : ''}>{formatCurrency(summary.safeDailySpend)}</strong>
        <small>{formatCurrency(summary.safeWeeklySpend)} weekly pace</small>
      </article>
      <article className="metric-card">
        <span className="metric-icon">
          <TrendingUp size={18} />
        </span>
        <p>Income</p>
        <strong>{formatCurrency(summary.income)}</strong>
        <small>{formatCurrency(summary.oneTimeIncome)} one-time</small>
      </article>
      <article className="metric-card">
        <span className="metric-icon">
          <PiggyBank size={18} />
        </span>
        <p>Reserved savings</p>
        <strong>{formatCurrency(summary.savingsTarget)}</strong>
        <small>{formatCurrency(summary.spendable)} spendable</small>
      </article>
      <article className="metric-card">
        <span className="metric-icon">
          <ArrowDownRight size={18} />
        </span>
        <p>Total spent</p>
        <strong>{formatCurrency(summary.totalSpent)}</strong>
        <small className={summary.remaining < 0 ? 'danger-text' : ''}>{formatCurrency(summary.remaining)} left</small>
      </article>
      <article className="metric-card">
        <span className="metric-icon">
          <CalendarDays size={18} />
        </span>
        <p>Days remaining</p>
        <strong>{summary.daysLeft}</strong>
        <small>Budget {formatCurrency(summary.periodBudget)}</small>
      </article>
    </section>
  );
}
