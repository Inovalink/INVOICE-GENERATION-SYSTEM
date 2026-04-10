'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  PaymentSpeedTrendGranularity,
  PaymentSpeedTrendPoint,
} from '@/lib/paymentSpeedTrend';
import { TrendingDown, TrendingUp } from 'lucide-react';

type Props = {
  initialGranularity: PaymentSpeedTrendGranularity;
  initialSeries: PaymentSpeedTrendPoint[];
};

export default function PaymentSpeedTrendChart({ initialGranularity, initialSeries }: Props) {
  const [granularity, setGranularity] = useState<PaymentSpeedTrendGranularity>(initialGranularity);
  const [series, setSeries] = useState<PaymentSpeedTrendPoint[]>(initialSeries);
  const [loading, setLoading] = useState(false);
  const skipRef = useRef(true);

  const load = useCallback(async (g: PaymentSpeedTrendGranularity) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payment-speed-trend?granularity=${g}`);
      const data = (await res.json()) as { series?: PaymentSpeedTrendPoint[] };
      if (Array.isArray(data.series)) setSeries(data.series);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    void load(granularity);
  }, [granularity, load]);

  const chartData = series.map((p) => ({
    label: p.label,
    averageDays: p.averageDays,
    paidInvoiceCount: p.paidInvoiceCount,
  }));

  const trend =
    series.length >= 2
      ? series[series.length - 1].averageDays - series[0].averageDays
      : null;

  return (
    <section className="payment-speed-trend" aria-label="Payment speed trend">
      <div className={`payment-speed-trend__card ${loading ? 'payment-speed-trend__card--loading' : ''}`}>
        <div className="payment-speed-trend__head">
          <div>
            <h3 className="payment-speed-trend__title">Payment Speed Trend</h3>
            <p className="payment-speed-trend__subtitle">
              Average days from invoice issue to payment, grouped by when payment was received (paid
              invoices only).
            </p>
          </div>
          <div className="payment-speed-trend__toggle" role="group" aria-label="Time grouping">
            <button
              type="button"
              className={granularity === 'weekly' ? 'active' : ''}
              onClick={() => setGranularity('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={granularity === 'monthly' ? 'active' : ''}
              onClick={() => setGranularity('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>

        {series.length === 0 ? (
          <p className="payment-speed-trend__empty">
            Not enough paid invoices with payments in the selected window to chart a trend yet.
          </p>
        ) : (
          <>
            {trend !== null && (
              <p className="payment-speed-trend__hint" aria-live="polite">
                {trend < 0 ? (
                  <>
                    <TrendingDown size={16} strokeWidth={2} aria-hidden />
                    <span>
                      Avg. payment time down <strong>{Math.abs(Math.round(trend * 10) / 10)}</strong> days
                      from first to last period shown (faster collections).
                    </span>
                  </>
                ) : trend > 0 ? (
                  <>
                    <TrendingUp size={16} strokeWidth={2} aria-hidden />
                    <span>
                      Avg. payment time up <strong>{Math.round(trend * 10) / 10}</strong> days from first
                      to last period shown.
                    </span>
                  </>
                ) : (
                  <span>Average payment time is stable across the range shown.</span>
                )}
              </p>
            )}

            <div className="payment-speed-trend__chart">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    width={40}
                    label={{
                      value: 'Days',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: 'var(--text-secondary)' },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                      fontSize: 12,
                    }}
                    formatter={(value, _name, item) => {
                      const v = typeof value === 'number' ? value : Number(value);
                      const num = Number.isFinite(v) ? v : 0;
                      const n = (item as { payload?: { paidInvoiceCount?: number } })?.payload
                        ?.paidInvoiceCount;
                      const suffix = n != null ? ` (${n} paid inv.)` : '';
                      return [`${num} days${suffix}`, 'Avg. payment time'];
                    }}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageDays"
                    stroke="var(--chart-revenue, #0d9488)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--chart-revenue, #0d9488)' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
