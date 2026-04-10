import { NextResponse } from 'next/server';
import {
  getPaymentSpeedTrendSeries,
  isPaymentSpeedTrendGranularity,
} from '@/lib/paymentSpeedTrend';
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

  try {
    const series = await getPaymentSpeedTrendSeries(prisma, { granularity: raw });
    return NextResponse.json({ granularity: raw, series });
  } catch (e) {
    console.error('payment-speed-trend', e);
    return NextResponse.json({ message: 'Failed to load payment speed trend' }, { status: 500 });
  }
}
