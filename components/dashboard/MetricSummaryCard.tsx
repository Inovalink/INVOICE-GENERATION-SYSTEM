import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Info } from 'lucide-react';

export type MetricAccent = 'primary' | 'trend' | 'pending' | 'overdue' | 'profit';

type TrendTone = 'positive' | 'negative' | 'neutral';

export type MetricSummaryCardProps = {
  label: string;
  value: string;
  accent: MetricAccent;
  icon: LucideIcon;
  trendLabel: string;
  trendTone?: TrendTone;
  trendDirection?: 'up' | 'down' | 'flat';
  /** Subtle motion on the icon when attention is useful (e.g. overdue balance). */
  wiggleIcon?: boolean;
};

function trendClass(tone: TrendTone): string {
  if (tone === 'positive') return 'metric-summary-card__trend--positive';
  if (tone === 'negative') return 'metric-summary-card__trend--negative';
  return 'metric-summary-card__trend--neutral';
}

export default function MetricSummaryCard({
  label,
  value,
  accent,
  icon: Icon,
  trendLabel,
  trendTone = 'neutral',
  trendDirection = 'flat',
  wiggleIcon = false,
}: MetricSummaryCardProps) {
  const TrendArrow =
    trendDirection === 'up' ? ArrowUp : trendDirection === 'down' ? ArrowDown : null;

  return (
    <div className={`metric-summary-card metric-summary-card--${accent}`}>
      <div className="metric-summary-card__accent" aria-hidden />
      <div className="metric-summary-card__inner">
        <div className="metric-summary-card__top">
          <span className="metric-summary-card__label">{label}</span>
          <div
            className={`metric-summary-card__icon-box ${wiggleIcon ? 'metric-summary-card__icon-box--wiggle' : ''}`}
          >
            <Icon size={20} strokeWidth={2} aria-hidden />
          </div>
        </div>
        <p className="metric-summary-card__value">{value}</p>
        <div className={`metric-summary-card__trend ${trendClass(trendTone)}`}>
          <Info size={14} strokeWidth={2} className="metric-summary-card__trend-info" />
          {TrendArrow && (
            <TrendArrow size={14} strokeWidth={2.5} className="metric-summary-card__trend-arrow" />
          )}
          <span className="metric-summary-card__trend-text">{trendLabel}</span>
        </div>
      </div>
    </div>
  );
}
