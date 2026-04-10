'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  FileText,
  Receipt,
  Send,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import type { DashboardAlertRow } from '@/lib/dashboardAlerts';
import './DashboardAlerts.css';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

type ParsedMeta = {
  client: string | null;
  amount: string | null;
  invoiceId: string | null;
};

function parseMeta(a: DashboardAlertRow): ParsedMeta {
  const description = a.description;
  /* Revenue copy is one self-contained sentence; chips would duplicate the body (client fallback used whole string). */
  if (a.kind === 'revenue') {
    return { client: null, amount: null, invoiceId: null };
  }

  const invoiceId = description.match(/Invoice\s+#([A-Za-z0-9-]+)/i)?.[1] ?? null;
  const amount =
    description.match(/(GHS|USD|EUR|GBP|NGN)\s?[\d,]+(?:\.\d+)?/i)?.[0] ?? null;

  let client: string | null = null;
  if (a.kind === 'payment') {
    const from = description.match(/from\s+(.+?)\s*\(Invoice\s+#/i);
    client = from?.[1]?.trim() ?? null;
  } else if (a.kind === 'system' && description.includes(' for ')) {
    const m = description.match(/for\s+([^(\d]+?)\s*\(/);
    client = m?.[1]?.trim() ?? null;
  } else if (a.kind === 'overdue' || a.kind === 'upcoming') {
    const beforeOwed = description.split(/(?:\s+owes\s+|\s+—\s+)/i)[0]?.trim();
    client = beforeOwed && beforeOwed.length < 120 ? beforeOwed : null;
  }

  return { client, amount, invoiceId };
}

function alertHeadline(a: DashboardAlertRow): string {
  if (a.kind === 'overdue') return 'Today - Payment due';
  if (a.kind === 'upcoming') return 'Upcoming - Payment due';
  return a.title;
}

function AlertGlyph({
  kind,
  revenueTrend,
}: {
  kind: DashboardAlertRow['kind'];
  revenueTrend?: DashboardAlertRow['revenueTrend'];
}) {
  const common = { size: 15 as const, strokeWidth: 2.25 as const, 'aria-hidden': true as const };
  switch (kind) {
    case 'payment':
      return <Banknote {...common} />;
    case 'system':
      return <FileText {...common} />;
    case 'receipt':
      return <Receipt {...common} />;
    case 'revenue':
      return revenueTrend === 'up' ? <TrendingUp {...common} /> : <TrendingDown {...common} />;
    default:
      return <TriangleAlert {...common} />;
  }
}

type Props = {
  alerts: DashboardAlertRow[];
};

export default function DashboardAlerts({ alerts }: Props) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const timeline = useMemo(
    () => [...alerts].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [alerts],
  );

  return (
    <section className="dashboard-alerts" aria-label="Financial timeline">
      <div className="dashboard-alerts__header">
        <h2 className="dashboard-alerts__title">Financial Timeline</h2>
        <Link href="/invoices" className="dashboard-alerts__planner-link">
          Planner view
        </Link>
      </div>

      <div className="dashboard-alerts__today-strip">
        <span className="dashboard-alerts__section-label">Today</span>
        <span className="dashboard-alerts__section-count" aria-label={`${timeline.length} items`}>
          {timeline.length}
        </span>
      </div>

      <ul className="dashboard-alerts__list" role="list">
          {timeline.length === 0 ? (
            <li className="dashboard-alerts__empty">No timeline items right now.</li>
          ) : (
            timeline.map((a) => {
              const meta = parseMeta(a);
              const done = completed[a.id];
              return (
                <li
                  key={a.id}
                  className={`dashboard-alerts__item dashboard-alerts__item--${a.kind}${
                    a.kind === 'revenue' && a.revenueTrend
                      ? ` dashboard-alerts__item--revenue-trend-${a.revenueTrend}`
                      : ''
                  }`}
                >
                  <div className="dashboard-alerts__accent-bar" aria-hidden />
                  <div className="dashboard-alerts__item-body">
                    <div className="dashboard-alerts__row-head">
                      <span className="dashboard-alerts__status-icon" aria-hidden>
                        <AlertGlyph kind={a.kind} revenueTrend={a.revenueTrend} />
                      </span>
                      <p className="dashboard-alerts__headline">{alertHeadline(a)}</p>
                      <p className="dashboard-alerts__time">{formatTime(a.at)}</p>
                    </div>
                    <p className="dashboard-alerts__desc">{a.description}</p>
                    <div className="dashboard-alerts__meta-chips">
                      {meta.client ? (
                        <span className="dashboard-alerts__chip">Client: {meta.client}</span>
                      ) : null}
                      {meta.amount ? (
                        <span className="dashboard-alerts__chip">Amount: {meta.amount}</span>
                      ) : null}
                      {meta.invoiceId ? (
                        <span className="dashboard-alerts__chip">Invoice ID: {meta.invoiceId}</span>
                      ) : null}
                    </div>
                    <div className="dashboard-alerts__actions">
                      <div className="dashboard-alerts__actions-secondary">
                        {a.href ? (
                          <Link href={a.href} className="dashboard-alerts__action-btn">
                            <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
                            Open invoice
                          </Link>
                        ) : (
                          <button type="button" className="dashboard-alerts__action-btn" disabled>
                            <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
                            Open invoice
                          </button>
                        )}
                        <button type="button" className="dashboard-alerts__action-btn" disabled>
                          <Send size={14} strokeWidth={2.25} aria-hidden />
                          Send reminder
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`dashboard-alerts__complete-btn ${done ? 'is-done' : ''}`}
                        onClick={() => setCompleted((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                      >
                        <CheckCircle2 size={12} strokeWidth={2} aria-hidden />
                        {done ? 'Completed' : 'Mark completed'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
      </ul>
    </section>
  );
}
