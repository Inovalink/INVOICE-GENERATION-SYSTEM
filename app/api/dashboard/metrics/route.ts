import { NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/auth/getCurrentUser';
import { getFinanceSummaryMetrics } from '@/lib/financeSummaryMetrics';
import { prisma } from '@/lib/prisma';

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET() {
  const session = await getSessionClaims();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const raw = await getFinanceSummaryMetrics(prisma);
    const metrics = {
      totalRevenueLifetime: safeNum(raw.totalRevenueLifetime),
      thisMonthRevenue: safeNum(raw.thisMonthRevenue),
      lastMonthRevenue: safeNum(raw.lastMonthRevenue),
      revenueMoM: raw.revenueMoM,
      expectedRevenueLifetime: safeNum(raw.expectedRevenueLifetime),
      expectedRevenueWoW: raw.expectedRevenueWoW,
      outstandingAmount: safeNum(raw.outstandingAmount),
      outstandingWoW: raw.outstandingWoW,
      pendingPaymentInvoiceCount: raw.pendingPaymentInvoiceCount,
      overdueAmountDue: safeNum(raw.overdueAmountDue),
      overdueCount: raw.overdueCount,
      overdueWoW: raw.overdueWoW,
      profit: safeNum(raw.profit),
      profitWoW: raw.profitWoW,
    };
    return NextResponse.json({ metrics });
  } catch (e) {
    console.error('dashboard/metrics', e);
    return NextResponse.json({ message: 'Failed to load metrics' }, { status: 500 });
  }
}
