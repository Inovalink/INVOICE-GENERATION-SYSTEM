'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { OverdueSourceInvoice } from '@/lib/financeSummaryMetrics';
import {
  daysOverdueFromDueDate,
  overdueRiskFromDaysOverdue,
  type OverdueRiskLevel,
} from '@/lib/invoiceDue';
import { formatGhs } from '@/lib/formatGhs';
import './OverdueInvoicesAlert.css';

type Props = {
  invoices: OverdueSourceInvoice[];
};

const RISK_BADGE: Record<OverdueRiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};

function daysOverdueForRow(inv: OverdueSourceInvoice): number {
  if (!inv.dueDate) return 1;
  return daysOverdueFromDueDate(inv.dueDate);
}

function formatDueLine(due: Date): string {
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OverdueInvoicesAlert({ invoices }: Props) {
  const sorted = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return [...invoices].sort((a, b) => {
      const da = daysOverdueForRow(a);
      const db = daysOverdueForRow(b);
      const ra = overdueRiskFromDaysOverdue(da);
      const rb = overdueRiskFromDaysOverdue(db);
      const byRisk = order[ra] - order[rb];
      if (byRisk !== 0) return byRisk;
      return db - da;
    });
  }, [invoices]);

  if (invoices.length === 0) return null;

  return (
    <section className="overdue-invoices-alert" aria-labelledby="overdue-invoices-alert-heading">
      <div className="overdue-invoices-alert__panel">
        <div className="overdue-invoices-alert__intro">
          <h2 id="overdue-invoices-alert-heading" className="overdue-invoices-alert__heading">
            Overdue Invoices Alert
          </h2>
          <p className="overdue-invoices-alert__sub">
            Some clients are falling behind. Review overdue invoices and take action today.
          </p>
        </div>

        <ul className="overdue-invoices-alert__cards">
          {sorted.map((inv) => {
            const daysLate = daysOverdueForRow(inv);
            const risk = overdueRiskFromDaysOverdue(daysLate);
            const amt = Math.max(0, inv.amountDue ?? 0);
            const due = inv.dueDate ? new Date(inv.dueDate) : null;
            const duePhrase = due ? formatDueLine(due) : '—';

            return (
              <li key={inv.id} className="overdue-invoices-alert__cards-item">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="overdue-invoices-alert__card"
                  aria-label={`Invoice ${inv.invoiceNumber}, ${inv.client.name}, ${formatGhs(amt)}, ${daysLate} days overdue, ${RISK_BADGE[risk]}`}
                >
                <div className="overdue-invoices-alert__card-top">
                  <span className="overdue-invoices-alert__card-inv">Invoice #{inv.invoiceNumber}</span>
                  <span
                    className={`overdue-invoices-alert__card-risk overdue-invoices-alert__card-risk--${risk}`}
                  >
                    {RISK_BADGE[risk]}
                  </span>
                </div>
                <p className="overdue-invoices-alert__card-amount">{formatGhs(amt)}</p>
                <p className="overdue-invoices-alert__card-delay">
                  {daysLate} day{daysLate === 1 ? '' : 's'} overdue (due {duePhrase})
                </p>
                <p className="overdue-invoices-alert__card-client">{inv.client.name}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
