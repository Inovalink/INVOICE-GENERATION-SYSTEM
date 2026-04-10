import Link from 'next/link';
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

export default async function InvoicesPage() {
  const [invoices, overdueSourceRows] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        receipt: true,
        items: true,
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

  return (
    <div className="invoices-list-page">
      <OverdueInvoicesAlert invoices={overdueInvoices} />
      <div className="content-card">
        <div className="content-card-header">
          <h3>All Invoices</h3>
          <Link href="/invoices/new" className="btn btn-primary create-invoice-btn">
            Create Invoice
          </Link>
        </div>
        <InvoicesTable invoices={invoicesForClient} itemsPerPage={10} />
      </div>
    </div>
  );
}
