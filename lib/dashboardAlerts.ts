import type { PrismaClient } from '@prisma/client';
import {
  isInvoiceOverdue,
  isInvoiceOverdueAsOf,
  overdueRiskFromDaysOverdue,
  type OverdueRiskLevel,
} from '@/lib/invoiceDue';
import { formatGhs } from '@/lib/formatGhs';

export type DashboardAlertIconVariant = 'bill' | 'chart' | 'card' | 'coin' | 'flag' | 'shield';

export type DashboardAlertRow = {
  id: string;
  kind: 'upcoming' | 'overdue' | 'payment' | 'system' | 'receipt' | 'revenue';
  title: string;
  description: string;
  /** Sort / tab filter timestamp (ISO). */
  at: string;
  unread: boolean;
  iconVariant: DashboardAlertIconVariant;
  href?: string | null;
  /** Month-over-month revenue timeline row: accent bar color + motion. */
  revenueTrend?: 'up' | 'down';
  /** Set for `kind === 'overdue'` from days past due date. */
  overdueRisk?: OverdueRiskLevel;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysUntilDue(dueDate: Date, now: Date): number {
  const due = startOfLocalDay(dueDate);
  const today = startOfLocalDay(now);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function buildDashboardAlerts(
  prisma: PrismaClient,
  options?: { dayBounds: { start: Date; end: Date } },
): Promise<DashboardAlertRow[]> {
  const day = options?.dayBounds;
  const now = new Date();
  const startToday = startOfLocalDay(now);
  const futureLimit = new Date(now);
  futureLimit.setDate(futureLimit.getDate() + 21);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    upcomingRows,
    openInvoicesForOverdue,
    recentPayments,
    recentInvoices,
    recentReceipts,
    thisMonthPay,
    lastMonthPay,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        amountDue: { gt: 0 },
        dueDate: day
          ? { gte: day.start, lt: day.end }
          : { gte: startToday, lte: futureLimit },
      },
      include: { client: true },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ['FINAL', 'PARTIALLY_PAID', 'PROFORMA'] },
      },
      orderBy: { dueDate: 'asc' },
      include: { client: true },
    }),
    prisma.payment.findMany({
      where: day ? { paymentDate: { gte: day.start, lt: day.end } } : undefined,
      orderBy: { paymentDate: 'desc' },
      take: day ? 50 : 25,
      include: {
        invoice: { include: { client: true } },
      },
    }),
    prisma.invoice.findMany({
      where: day ? { createdAt: { gte: day.start, lt: day.end } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: day ? 20 : 8,
      include: { client: true },
    }),
    prisma.receipt.findMany({
      where: day ? { createdAt: { gte: day.start, lt: day.end } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: day ? 15 : 5,
      include: { invoice: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: thisMonthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: lastMonthStart, lt: thisMonthStart } },
      _sum: { amount: true },
    }),
  ]);

  const overdueRows = openInvoicesForOverdue.filter((inv) =>
    day
      ? isInvoiceOverdueAsOf(
          {
            status: inv.status,
            paymentStatus: inv.paymentStatus,
            dueDate: inv.dueDate,
            amountDue: inv.amountDue,
            total: inv.total,
            depositAmount: inv.depositAmount,
          },
          day.start,
        )
      : isInvoiceOverdue({
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          dueDate: inv.dueDate,
          amountDue: inv.amountDue,
          total: inv.total,
          depositAmount: inv.depositAmount,
        }),
  );

  const alerts: DashboardAlertRow[] = [];

  const ms24h = 24 * 60 * 60 * 1000;
  const isUnread = (d: Date) => Date.now() - d.getTime() < ms24h;

  const refNow = day ? day.start : now;

  for (const inv of upcomingRows) {
    if (!inv.dueDate) continue;
    const overdueCheck = day
      ? isInvoiceOverdueAsOf(
          {
            status: inv.status,
            paymentStatus: inv.paymentStatus,
            dueDate: inv.dueDate,
            amountDue: inv.amountDue,
            total: inv.total,
            depositAmount: inv.depositAmount,
          },
          day.start,
        )
      : isInvoiceOverdue({
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          dueDate: inv.dueDate,
          amountDue: inv.amountDue,
          total: inv.total,
          depositAmount: inv.depositAmount,
        });
    if (overdueCheck) {
      continue;
    }
    const days = daysUntilDue(inv.dueDate, refNow);
    const amt = Math.max(0, inv.amountDue ?? 0);
    alerts.push({
      id: `upcoming-${inv.id}`,
      kind: 'upcoming',
      title: 'Upcoming payment due',
      description: `${inv.client.name} — ${formatGhs(amt)} due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} (Invoice #${inv.invoiceNumber}).`,
      at: inv.dueDate.toISOString(),
      unread: isUnread(inv.updatedAt),
      iconVariant: 'bill',
      href: `/invoices/${inv.id}`,
    });
  }

  for (const inv of overdueRows) {
    const due = inv.dueDate ?? inv.issueDate;
    const amt = Math.max(0, inv.amountDue ?? 0);
    const daysLate = inv.dueDate
      ? Math.max(
          1,
          Math.round(
            (startOfLocalDay(refNow).getTime() - startOfLocalDay(inv.dueDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1;
    alerts.push({
      id: `overdue-${inv.id}`,
      kind: 'overdue',
      title: 'Overdue payment',
      description: `${inv.client.name} owes ${formatGhs(amt)} (${daysLate} day${daysLate === 1 ? '' : 's'} overdue, Invoice #${inv.invoiceNumber}).`,
      at: (inv.dueDate ?? inv.updatedAt).toISOString(),
      unread: true,
      iconVariant: 'coin',
      href: `/invoices/${inv.id}`,
      overdueRisk: overdueRiskFromDaysOverdue(daysLate),
    });
  }

  for (const p of recentPayments) {
    const c = p.invoice.client?.name ?? 'Customer';
    const invNo = p.invoice.invoiceNumber;
    const method = p.paymentMethod.replace(/_/g, ' ');
    const ref = p.transactionRef ? ` · Ref ${p.transactionRef}` : '';
    alerts.push({
      id: `payment-${p.id}`,
      kind: 'payment',
      title: 'Payment received',
      description: `${formatGhs(p.amount)} from ${c} (Invoice #${invNo}) via ${method}${ref}.`,
      at: p.paymentDate.toISOString(),
      unread: isUnread(p.createdAt),
      iconVariant: 'card',
      href: `/invoices/${p.invoiceId}`,
    });
  }

  for (const inv of recentInvoices) {
    alerts.push({
      id: `sys-inv-${inv.id}`,
      kind: 'system',
      title: 'Invoice created',
      description: `Invoice #${inv.invoiceNumber} for ${inv.client.name} (${formatGhs(inv.total)}).`,
      at: inv.createdAt.toISOString(),
      unread: false,
      iconVariant: 'shield',
      href: `/invoices/${inv.id}`,
    });
  }

  for (const r of recentReceipts) {
    alerts.push({
      id: `sys-rcpt-${r.id}`,
      kind: 'receipt',
      title: 'Receipt issued',
      description: `Receipt ${r.receiptNumber} for Invoice #${r.invoice.invoiceNumber} (${formatGhs(r.totalAmount)}).`,
      at: r.createdAt.toISOString(),
      unread: false,
      iconVariant: 'flag',
      href: `/receipts/${r.id}`,
    });
  }

  if (!day) {
    const cur = thisMonthPay._sum.amount ?? 0;
    const prev = lastMonthPay._sum.amount ?? 0;
    if (prev > 0 && cur < prev) {
      const drop = Math.round(((prev - cur) / prev) * 100);
      if (drop >= 5) {
        alerts.push({
          id: 'revenue-mom-down',
          kind: 'revenue',
          title: 'Revenue trend',
          description: `Collections this month are about ${drop}% lower than last month (${formatGhs(cur)} vs ${formatGhs(prev)}).`,
          at: now.toISOString(),
          unread: true,
          iconVariant: 'chart',
          href: null,
          revenueTrend: 'down',
        });
      }
    } else if (prev > 0 && cur > prev) {
      const rise = Math.round(((cur - prev) / prev) * 100);
      if (rise >= 5) {
        alerts.push({
          id: 'revenue-mom-up',
          kind: 'revenue',
          title: 'Revenue trend',
          description: `Collections this month are about ${rise}% higher than last month (${formatGhs(cur)} vs ${formatGhs(prev)}).`,
          at: now.toISOString(),
          unread: true,
          iconVariant: 'chart',
          href: null,
          revenueTrend: 'up',
        });
      }
    }
  }

  alerts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return alerts;
}
