import type { PrismaClient } from '@prisma/client';
import { isInvoiceOverdue } from '@/lib/invoiceDue';

export type InvoiceStatusBreakdown = {
  paid: number;
  pending: number;
  overdue: number;
  /** Non-cancelled invoices only (paid + pending + overdue). */
  total: number;
};

/**
 * Classifies each non-cancelled invoice: PAID, overdue (unpaid, past due), or pending (else).
 */
export async function getInvoiceStatusBreakdown(prisma: PrismaClient): Promise<InvoiceStatusBreakdown> {
  const rows = await prisma.invoice.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      status: true,
      paymentStatus: true,
      dueDate: true,
      amountDue: true,
      total: true,
      depositAmount: true,
    },
  });

  let paid = 0;
  let pending = 0;
  let overdue = 0;

  for (const inv of rows) {
    if (inv.status === 'PAID') {
      paid += 1;
      continue;
    }
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
      overdue += 1;
      continue;
    }
    pending += 1;
  }

  const total = rows.length;
  return { paid, pending, overdue, total };
}

/** Status mix for invoices issued on a single local calendar day (issueDate in [start, end)). */
export async function getInvoiceStatusBreakdownForIssueDay(
  prisma: PrismaClient,
  bounds: { start: Date; end: Date },
): Promise<InvoiceStatusBreakdown> {
  const rows = await prisma.invoice.findMany({
    where: {
      status: { not: 'CANCELLED' },
      issueDate: { gte: bounds.start, lt: bounds.end },
    },
    select: {
      status: true,
      paymentStatus: true,
      dueDate: true,
      amountDue: true,
      total: true,
      depositAmount: true,
    },
  });

  let paid = 0;
  let pending = 0;
  let overdue = 0;

  for (const inv of rows) {
    if (inv.status === 'PAID') {
      paid += 1;
      continue;
    }
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
      overdue += 1;
      continue;
    }
    pending += 1;
  }

  return { paid, pending, overdue, total: rows.length };
}
