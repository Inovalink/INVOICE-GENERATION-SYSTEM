'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueGranularity, RevenueTrendPoint } from '@/lib/revenueTrends';
import { formatGhs } from '@/lib/formatGhs';
import './RevenueTrendsSection.css';

const OPTIONS: { value: RevenueGranularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

type Props = {
  /** When set, chart shows daily payment totals for 14 days ending on this date (YYYY-MM-DD). */
  focusDate?: string;
};

export default function RevenueTrendsSection({ focusDate }: Props) {
  const gradientId = useId().replace(/:/g, '');
  const [granularity, setGranularity] = useState<RevenueGranularity>('monthly');
  const [series, setSeries] = useState<RevenueTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (g: RevenueGranularity) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/revenue-trends?granularity=${encodeURIComponent(g)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.message === 'string' ? body.message : 'Request failed');
      }
      const data = (await res.json()) as { series: RevenueTrendPoint[] };
      setSeries(Array.isArray(data.series) ? data.series : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load trends');
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFocus = useCallback(async (iso: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/revenue-trends?focusDate=${encodeURIComponent(iso)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.message === 'string' ? body.message : 'Request failed');
      }
      const data = (await res.json()) as { series: RevenueTrendPoint[] };
      setSeries(Array.isArray(data.series) ? data.series : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load trends');
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focusDate) {
      void loadFocus(focusDate);
    } else {
      void load(granularity);
    }
  }, [focusDate, granularity, load, loadFocus]);

  const chartData = series.map((p) => ({ ...p, amount: Math.round(p.amount * 100) / 100 }));

  return (
    <section className="revenue-trends-section content-card" aria-labelledby="revenue-trends-heading">
      <div className="revenue-trends-header">
        <div>
          <h3 id="revenue-trends-heading">Revenue trends</h3>
          <p className="revenue-trends-sub">
            {focusDate
              ? 'Daily payments (14 days ending on selected date)'
              : 'Payment revenue by period'}
          </p>
        </div>
        {!focusDate && (
          <div className="revenue-trends-segment" role="tablist" aria-label="Trend period">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={granularity === opt.value}
                className={`revenue-trends-segment-btn ${granularity === opt.value ? 'active' : ''}`}
                onClick={() => setGranularity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="revenue-trends-chart-wrap">
        {loading ? (
          <div className="revenue-trends-state">Loading chart…</div>
        ) : error ? (
          <div className="revenue-trends-state revenue-trends-state--error">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="revenue-trends-state">No payment data in this range yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-revenue-glow)" stopOpacity={1} />
                  <stop offset="55%" stopColor="var(--chart-revenue)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--chart-revenue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={focusDate || granularity === 'daily' ? 4 : 8}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(v) =>
                  typeof v === 'number' && v >= 1000
                    ? `${Math.round(v / 1000)}k`
                    : String(v)
                }
                width={44}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  boxShadow: 'var(--shadow-md)',
                }}
                labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--chart-revenue-strong)' }}
                formatter={(value) => [
                  formatGhs(Number(value ?? 0)),
                  'Revenue',
                ]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                name="Revenue"
                stroke="var(--chart-revenue-strong)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
