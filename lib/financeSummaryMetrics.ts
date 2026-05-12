import type { Prisma, PrismaClient } from '@prisma/client';
import { startOfWeek, subWeeks } from 'date-fns';
import { isInvoiceOverdue, isInvoiceOverdueAsOf } from '@/lib/invoiceDue';
import {
  formatDayOverDayTrend,
  formatRevenueMoM,
  formatRevenueWoW,
  type MoMTrend,
} from '@/lib/formatGhs';

export type OverdueSourceInvoice = Prisma.InvoiceGetPayload<{
  select: {
    id: true;
    invoiceNumber: true;
    status: true;
    paymentStatus: true;
    dueDate: true;
    amountDue: true;
    total: true;
    depositAmount: true;
    client: { select: { name: true } };
  };
}>;

export type FinanceSummaryMetrics = {
  totalRevenueLifetime: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  revenueMoM: ReturnType<typeof formatRevenueMoM>;
  expectedRevenueLifetime: number;
  expectedRevenueWoW: MoMTrend;
  outstandingAmount: number;
  outstandingWoW: MoMTrend;
  pendingPaymentInvoiceCount: number;
  overdueAmountDue: number;
  overdueCount: number;
  overdueWoW: MoMTrend;
  profit: number;
  profitWoW: MoMTrend;
  /** Open invoices used for overdue detection — reuse on the dashboard to avoid a second query. */
  overdueSourceRows: OverdueSourceInvoice[];
};

export type FinanceDayMetrics = {
  paymentsTotal: number;
  paymentsVsPreviousDay: MoMTrend;
  expectedRevenue: number;
  expectedRevenueVsPreviousDay: MoMTrend;
  outstandingAmount: number;
  outstandingVsPreviousDay: MoMTrend;
  overdueAmountDue: number;
  overdueVsPreviousDay: MoMTrend;
  overdueCount: number;
  profit: number;
  profitVsPreviousDay: MoMTrend;
};

const neutralTrend = (label: string): MoMTrend => ({
  label,
  tone: 'neutral',
  direction: 'flat',
});

/** Open invoices used for overdue detection on the dashboard (single query, no finance aggregates). */
export async function getOverdueSourceRows(prisma: PrismaClient): Promise<OverdueSourceInvoice[]> {
  return prisma.invoice.findMany({
    where: {
      status: { in: ['FINAL', 'PARTIALLY_PAID', 'PROFORMA'] },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      paymentStatus: true,
      dueDate: true,
      amountDue: true,
      total: true,
      depositAmount: true,
      client: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function getFinanceSummaryMetrics(prisma: PrismaClient): Promise<FinanceSummaryMetrics> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const prevWeekStart = subWeeks(weekStart, 1);

  const [
    allTimePaymentsAgg,
    thisMonthPaymentsAgg,
    lastMonthPaymentsAgg,
    outstandingAgg,
    pendingPaymentInvoiceCount,
    overdueSourceRows,
    expectedAgg,
    profitAgg,
    issuedThisWeek,
    issuedLastWeek,
    marginThisWeek,
    marginLastWeek,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        paymentDate: { gte: thisMonthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        paymentDate: { gte: lastMonthStart, lt: thisMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        amountDue: { gt: 0 },
      },
      _sum: { amountDue: true },
    }),
    prisma.invoice.count({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        amountDue: { gt: 0 },
      },
    }),
    getOverdueSourceRows(prisma),
    prisma.invoice.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: { status: 'PAID' },
      _sum: { subtotal: true, discount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        issueDate: { gte: weekStart },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        issueDate: { gte: prevWeekStart, lt: weekStart },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        issueDate: { gte: weekStart },
      },
      _sum: { subtotal: true, discount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        issueDate: { gte: prevWeekStart, lt: weekStart },
      },
      _sum: { subtotal: true, discount: true },
    }),
  ]);

  const totalRevenueLifetime = allTimePaymentsAgg._sum.amount ?? 0;
  const thisMonthRevenue = thisMonthPaymentsAgg._sum.amount ?? 0;
  const lastMonthRevenue = lastMonthPaymentsAgg._sum.amount ?? 0;
  const revenueMoM = formatRevenueMoM(thisMonthRevenue, lastMonthRevenue);
  const outstandingAmount = outstandingAgg._sum.amountDue ?? 0;
  const expectedRevenueLifetime = expectedAgg._sum.total ?? 0;
  const sub = profitAgg._sum.subtotal ?? 0;
  const disc = profitAgg._sum.discount ?? 0;
  const profit = Math.max(0, sub - disc);

  const overdueAll = overdueSourceRows.filter((inv) =>
    isInvoiceOverdue({
      status: inv.status,
      paymentStatus: inv.paymentStatus,
      dueDate: inv.dueDate,
      amountDue: inv.amountDue,
      total: inv.total,
      depositAmount: inv.depositAmount,
    }),
  );

  const overdueAmountDue = overdueAll.reduce((sum, inv) => sum + Math.max(0, inv.amountDue ?? 0), 0);
  const overdueCount = overdueAll.length;

  const issuedTW = issuedThisWeek._sum.total ?? 0;
  const issuedLW = issuedLastWeek._sum.total ?? 0;
  const expectedRevenueWoW = formatRevenueWoW(issuedTW, issuedLW);

  const outstandingWoW = neutralTrend('Open invoice balance');
  const overdueWoW =
    overdueCount === 0
      ? neutralTrend('No overdue invoices')
      : neutralTrend(
          `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} past due`,
        );

  const mTW =
    (marginThisWeek._sum.subtotal ?? 0) - (marginThisWeek._sum.discount ?? 0);
  const mLW =
    (marginLastWeek._sum.subtotal ?? 0) - (marginLastWeek._sum.discount ?? 0);
  const profitWoW = formatRevenueWoW(Math.max(0, mTW), Math.max(0, mLW));

  return {
    totalRevenueLifetime,
    thisMonthRevenue,
    lastMonthRevenue,
    revenueMoM,
    expectedRevenueLifetime,
    expectedRevenueWoW,
    outstandingAmount,
    outstandingWoW,
    pendingPaymentInvoiceCount,
    overdueAmountDue,
    overdueCount,
    overdueWoW,
    profit,
    profitWoW,
    overdueSourceRows,
  };
}

function profitFromPayments(
  payments: { amount: number; invoice: { total: number; tax: number } }[],
): number {
  let sum = 0;
  for (const p of payments) {
    const inv = p.invoice;
    const t = inv.total > 0 ? (p.amount / inv.total) * (inv.tax ?? 0) : 0;
    sum += p.amount - t;
  }
  return sum;
}

export async function getFinanceDayMetrics(
  prisma: PrismaClient,
  bounds: { start: Date; end: Date },
): Promise<FinanceDayMetrics> {
  const prevEnd = bounds.start;
  const prevStart = new Date(bounds.start);
  prevStart.setDate(prevStart.getDate() - 1);

  const [
    payCur,
    payPrev,
    invCur,
    invPrev,
    outCur,
    outPrev,
    payRowsCur,
    payRowsPrev,
    overdueRows,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { paymentDate: { gte: bounds.start, lt: bounds.end } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: prevStart, lt: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        issueDate: { gte: bounds.start, lt: bounds.end },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: 'CANCELLED' },
        issueDate: { gte: prevStart, lt: prevEnd },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        amountDue: { gt: 0 },
        dueDate: { gte: bounds.start, lt: bounds.end },
      },
      _sum: { amountDue: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        amountDue: { gt: 0 },
        dueDate: { gte: prevStart, lt: prevEnd },
      },
      _sum: { amountDue: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: bounds.start, lt: bounds.end } },
      select: { amount: true, invoice: { select: { total: true, tax: true } } },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: prevStart, lt: prevEnd } },
      select: { amount: true, invoice: { select: { total: true, tax: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ['FINAL', 'PARTIALLY_PAID'] },
        amountDue: { gt: 0 },
      },
      select: {
        status: true,
        paymentStatus: true,
        dueDate: true,
        amountDue: true,
        total: true,
        depositAmount: true,
      },
    }),
  ]);

  const paymentsTotal = payCur._sum.amount ?? 0;
  const paymentsPrev = payPrev._sum.amount ?? 0;
  const expectedRevenue = invCur._sum.total ?? 0;
  const expectedPrev = invPrev._sum.total ?? 0;
  const outstandingAmount = outCur._sum.amountDue ?? 0;
  const outstandingPrevious = outPrev._sum.amountDue ?? 0;

  const overdueOnDay = overdueRows.filter((inv) =>
    isInvoiceOverdueAsOf(
      {
        status: inv.status,
        paymentStatus: inv.paymentStatus,
        dueDate: inv.dueDate,
        amountDue: inv.amountDue,
        total: inv.total,
        depositAmount: inv.depositAmount,
      },
      bounds.start,
    ),
  );
  const overduePrev = overdueRows.filter((inv) =>
    isInvoiceOverdueAsOf(
      {
        status: inv.status,
        paymentStatus: inv.paymentStatus,
        dueDate: inv.dueDate,
        amountDue: inv.amountDue,
        total: inv.total,
        depositAmount: inv.depositAmount,
      },
      prevStart,
    ),
  );

  const overdueAmountDue = overdueOnDay.reduce(
    (s, inv) => s + Math.max(0, inv.amountDue ?? 0),
    0,
  );
  const overdueAmountPrev = overduePrev.reduce(
    (s, inv) => s + Math.max(0, inv.amountDue ?? 0),
    0,
  );

  const profit = profitFromPayments(payRowsCur);
  const profitPrevious = profitFromPayments(payRowsPrev);

  return {
    paymentsTotal,
    paymentsVsPreviousDay: formatDayOverDayTrend(paymentsTotal, paymentsPrev),
    expectedRevenue,
    expectedRevenueVsPreviousDay: formatDayOverDayTrend(expectedRevenue, expectedPrev),
    outstandingAmount,
    outstandingVsPreviousDay: formatDayOverDayTrend(outstandingAmount, outstandingPrevious),
    overdueAmountDue,
    overdueVsPreviousDay: formatDayOverDayTrend(overdueAmountDue, overdueAmountPrev),
    overdueCount: overdueOnDay.length,
    profit,
    profitVsPreviousDay: formatDayOverDayTrend(profit, profitPrevious),
  };
}
