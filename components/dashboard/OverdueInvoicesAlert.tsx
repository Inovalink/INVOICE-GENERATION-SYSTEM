'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { OverdueSourceInvoice } from '@/lib/financeSummaryMetrics';
import { formatGhs } from '@/lib/formatGhs';

type Props = {
  invoices: OverdueSourceInvoice[];
};

export default function OverdueInvoicesAlert({ invoices }: Props) {
  if (invoices.length === 0) return null;

  const totalDue = invoices.reduce((sum, inv) => sum + Math.max(0, inv.amountDue ?? 0), 0);

  return (
    <div
      className="content-card"
      style={{
        marginBottom: '1rem',
        borderLeft: '4px solid var(--status-overdue-text, #b45309)',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
      }}
      role="status"
    >
      <AlertTriangle
        size={22}
        style={{ flexShrink: 0, color: 'var(--status-overdue-text, #b45309)', marginTop: '0.15rem' }}
        aria-hidden
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>
          {invoices.length === 1 ? '1 invoice is overdue' : `${invoices.length} invoices are overdue`}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>
          Total outstanding on overdue invoices: <strong>{formatGhs(totalDue)}</strong>
        </p>
        <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
          {invoices.slice(0, 5).map((inv) => (
            <li key={inv.id}>
              <Link href={`/invoices/${inv.id}`}>
                {inv.invoiceNumber} · {inv.client.name}
              </Link>
            </li>
          ))}
        </ul>
        {invoices.length > 5 && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            <Link href="/invoices">View all invoices</Link>
          </p>
        )}
      </div>
    </div>
  );
}
