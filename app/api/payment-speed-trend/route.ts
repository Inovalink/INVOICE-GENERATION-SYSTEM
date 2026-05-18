import { NextResponse } from 'next/server';
import {
  getPaymentSpeedTrendSeries,
  isPaymentSpeedTrendGranularity,
} from '@/lib/paymentSpeedTrend';
import { getCurrentContext } from '@/lib/auth/getCurrentUser';
import { scopeFromContext } from '@/lib/auth/tenantScope';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('granularity') ?? 'monthly';
  if (!isPaymentSpeedTrendGranularity(raw)) {
    return NextResponse.json(
      { message: 'Invalid granularity. Use weekly or monthly.' },
      { status: 400 },
    );
  }
  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const scope = scopeFromContext(ctx);

  try {
    const series = await getPaymentSpeedTrendSeries(prisma, { granularity: raw, scope });
    return NextResponse.json({ granularity: raw, series });
  } catch (e) {
    console.error('payment-speed-trend', e);
    return NextResponse.json({ message: 'Failed to load payment speed trend' }, { status: 500 });
  }
}
