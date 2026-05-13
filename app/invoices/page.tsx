import Link from 'next/link';
import { connection } from 'next/server';
import InvoicesTable, { InvoiceSummary } from '@/components/invoices/InvoicesTable';
import OverdueInvoicesAlert from '@/components/dashboard/OverdueInvoicesAlert';
import { isInvoiceOverdue } from '@/lib/invoiceDue';
import { getOverdueSourceRows } from '@/lib/financeSummaryMetrics';
import '../dashboard.css';
import './invoices.css';
import { prisma } from '@/lib/prisma';

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

function parseRangeDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function formatRangeLabel(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const f = from.toLocaleDateString('en-US', opts);
  const t = to.toLocaleDateString('en-US', opts);
  return f === t ? f : `${f} — ${t}`;
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  await connection();

  const sp = (await searchParams) ?? {};
  const fromDate = parseRangeDate(sp.from);
  const toDate = parseRangeDate(sp.to);
  const hasRange = fromDate !== null && toDate !== null;

  // End of the "to" day (inclusive)
  const toDateEnd = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : null;

  const [invoices, overdueSourceRows] = await Promise.all([
    prisma.invoice.findMany({
      where: hasRange
        ? { issueDate: { gte: fromDate!, lt: toDateEnd! } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        totalAmount: true,
        depositAmount: true,
        amountDue: true,
        paymentStatus: true,
        status: true,
        issueDate: true,
        dueDate: true,
        paymentTerms: true,
        notes: true,
        client: { select: { name: true, company: true, address: true, email: true } },
        receipt: { select: { id: true } },
        items: { select: { id: true, description: true, quantity: true, unitPrice: true } },
      },
    }),
    getOverdueSourceRows(prisma),
  ]);

  const overdueInvoices = overdueSourceRows.filter((inv) =>
    isInvoiceOverdue({
      status: inv.status,
      paymentStatus: inv.paymentStatus,
      dueDate: inv.dueDate,
      amountDue: inv.amountDue,
      total: inv.total,
      depositAmount: inv.depositAmount,
    }),
  );

  const invoicesForClient: InvoiceSummary[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    subtotal: safeNumber(inv.subtotal),
    discount: safeNumber(inv.discount),
    tax: safeNumber(inv.tax),
    total: safeNumber(inv.total),
    totalAmount: safeNumber(inv.totalAmount),
    depositAmount: safeNumber(inv.depositAmount),
    amountDue: safeNumber(inv.amountDue),
    paymentStatus: inv.paymentStatus,
    status: inv.status,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    paymentTerms: inv.paymentTerms,
    notes: inv.notes,
    client: {
      name: inv.client.name,
      company: inv.client.company,
      address: inv.client.address ?? null,
      email: inv.client.email ?? null,
    },
    items: inv.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
    receipt: inv.receipt ? { id: inv.receipt.id } : null,
  }));

  const rangeLabel = hasRange ? formatRangeLabel(fromDate!, toDate!) : null;

  return (
    <div className="invoices-list-page">
      <OverdueInvoicesAlert invoices={overdueInvoices} />
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>{rangeLabel ? `Invoices — ${rangeLabel}` : 'All Invoices'}</h3>
            {hasRange && (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {invoicesForClient.length} invoice{invoicesForClient.length !== 1 ? 's' : ''} issued in this period.{' '}
                <Link href="/invoices" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  View all
                </Link>
              </p>
            )}
          </div>
          <Link href="/invoices/new" className="btn btn-primary create-invoice-btn">
            Create Invoice
          </Link>
        </div>
        <InvoicesTable invoices={invoicesForClient} itemsPerPage={10} />
      </div>
    </div>
  );
}
