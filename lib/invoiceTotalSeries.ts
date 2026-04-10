import type { PrismaClient } from '@prisma/client';
import {
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { isInvoiceOverdue } from '@/lib/invoiceDue';

export type InvoiceTotalFilter = 'paid' | 'pending' | 'overdue' | 'proforma';

export type InvoiceTotalBarPoint = {
  label: string;
  value: number;
};

export type InvoiceTotalCardPayload = {
  weekly: Record<InvoiceTotalFilter, InvoiceTotalBarPoint[]>;
  monthly: Record<InvoiceTotalFilter, InvoiceTotalBarPoint[]>;
};

type InvRow = {
  issueDate: Date;
  status: 'PROFORMA' | 'FINAL' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  paymentStatus: string;
  dueDate: Date | null;
  amountDue: number;
  total: number;
  depositAmount: number;
};

function classifyInvoice(inv: InvRow): InvoiceTotalFilter | null {
  if (inv.status === 'CANCELLED') return null;
  if (inv.status === 'PROFORMA') return 'proforma';
  if (inv.status === 'PAID') return 'paid';
  if (
    isInvoiceOverdue({
      status: inv.status,
      paymentStatus: inv.paymentStatus,
      dueDate: inv.dueDate,
      amountDue: inv.amountDue,
      total: inv.total,
      depositAmount: inv.depositAmount,
    })
  ) {
    return 'overdue';
  }
  return 'pending';
}

const FILTERS: InvoiceTotalFilter[] = ['paid', 'pending', 'overdue', 'proforma'];

/**
 * Weekly (7 ISO weeks) and monthly (6 calendar months) counts of issued invoices
 * by coarse status, for the Total Invoices bar card.
 */
export async function getInvoiceTotalCardData(prisma: PrismaClient): Promise<InvoiceTotalCardPayload> {
  const rows = await prisma.invoice.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      issueDate: true,
      status: true,
      paymentStatus: true,
      dueDate: true,
      amountDue: true,
      total: true,
      depositAmount: true,
    },
  });

  const classified = rows
    .map((inv) => {
      const kind = classifyInvoice(inv as InvRow);
      return kind ? { issueDate: inv.issueDate, kind } : null;
    })
    .filter((x): x is { issueDate: Date; kind: InvoiceTotalFilter } => x !== null);

  const now = new Date();

  const weekBuckets: { label: string; start: Date; end: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const ref = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
    const ws = startOfWeek(ref, { weekStartsOn: 1 });
    const end = addWeeks(ws, 1);
    weekBuckets.push({ label: format(ws, 'MMM d'), start: ws, end });
  }

  const monthBuckets: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = subMonths(startOfMonth(now), i);
    const ms = startOfMonth(ref);
    const end = addMonths(ms, 1);
    monthBuckets.push({ label: format(ms, 'MMM yy'), start: ms, end });
  }

  const weekly = {} as Record<InvoiceTotalFilter, InvoiceTotalBarPoint[]>;
  const monthly = {} as Record<InvoiceTotalFilter, InvoiceTotalBarPoint[]>;

  for (const f of FILTERS) {
    weekly[f] = weekBuckets.map((b) => ({
      label: b.label,
      value: classified.filter((c) => c.kind === f && c.issueDate >= b.start && c.issueDate < b.end)
        .length,
    }));
    monthly[f] = monthBuckets.map((b) => ({
      label: b.label,
      value: classified.filter((c) => c.kind === f && c.issueDate >= b.start && c.issueDate < b.end)
        .length,
    }));
  }

  return { weekly, monthly };
}
