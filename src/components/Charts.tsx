import { useState } from 'react';
import { CategorySummary, TrendPoint } from '../lib/budgetMath';
import { categoryColor } from '../lib/categoryVisuals';
import { formatCompactCurrency, formatCurrency } from '../lib/money';

type Props = {
  categories: CategorySummary[];
  trend: TrendPoint[];
};

export function Charts({ categories, trend }: Props) {
  const [hoveredPoint, setHoveredPoint] = useState<{ point: TrendPoint; x: number; y: number } | null>(null);
  const maxTrend = Math.max(...trend.map((item) => item.cumulative), 1);
  const points = trend
    .map((point, index) => {
      const x = trend.length <= 1 ? 0 : (index / (trend.length - 1)) * 100;
      const y = 100 - (point.cumulative / maxTrend) * 92;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <section className="chart-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Allocation</p>
            <h2>Spending by category</h2>
          </div>
        </div>
        <div className="bar-chart">
          {categories.map((item) => {
            const fillPercent = Math.min(100, Math.max(0, item.percentUsed));
            return (
              <div className="bar-row" key={item.category}>
                <span>{item.category}</span>
                <div
                  className="bar-track"
                  role="progressbar"
                  aria-label={`${item.category} budget used`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fillPercent}
                  aria-valuetext={`${item.percentUsed}% used`}
                >
                  <div
                    className="bar-fill"
                    style={{
                      width: `${fillPercent}%`,
                      background: categoryColor(item.category)
                    }}
                  />
                </div>
                <strong>{formatCompactCurrency(item.spent)}</strong>
              </div>
            );
          })}
        </div>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Pace</p>
            <h2>Spending over time</h2>
          </div>
          <strong>{formatCurrency(trend[trend.length - 1]?.cumulative ?? 0)}</strong>
        </div>
        <div className="trend-chart-wrap" onMouseLeave={() => setHoveredPoint(null)}>
          <svg className="trend-chart" viewBox="0 0 100 100" role="img" aria-label="Cumulative spending trend">
            <defs>
              <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.36" />
                <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" points="0,25 100,25" />
            <polyline fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" points="0,55 100,55" />
            <polygon fill="url(#trendArea)" points={`0,100 ${points} 100,100`} />
            <polyline fill="none" stroke="#67e8f9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" points={points} />
            {trend.map((point, index) => {
              const x = trend.length <= 1 ? 0 : (index / (trend.length - 1)) * 100;
              const y = 100 - (point.cumulative / maxTrend) * 92;
              return (
                <g key={point.date}>
                  <rect
                    x={Math.max(0, x - 1.7)}
                    y="0"
                    width="3.4"
                    height="100"
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint({ point, x, y })}
                    onMouseMove={() => setHoveredPoint({ point, x, y })}
                  />
                  {hoveredPoint?.point.date === point.date && (
                    <>
                      <line x1={x} x2={x} y1="0" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="0.55" />
                      <circle cx={x} cy={y} r="2.2" fill="#67e8f9" stroke="var(--panel)" strokeWidth="1" />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {hoveredPoint && (
            <div
              className="trend-tooltip"
              style={{
                left: `${Math.min(78, Math.max(2, hoveredPoint.x))}%`,
                top: `${Math.min(78, Math.max(8, hoveredPoint.y))}%`
              }}
            >
              <strong>{hoveredPoint.point.date}</strong>
              <span>Spent {formatCurrency(hoveredPoint.point.spent)}</span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
