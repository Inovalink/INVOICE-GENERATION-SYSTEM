import { NextResponse } from 'next/server';
import {
  getRevenueTrendSeries,
  getRevenueTrendSeriesEndingOnDay,
  isRevenueGranularity,
} from '@/lib/revenueTrends';
import { parseLocalDayBounds } from '@/lib/financeDayBounds';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const focusRaw = searchParams.get('focusDate');

  if (focusRaw) {
    const bounds = parseLocalDayBounds(focusRaw);
    if (!bounds) {
      return NextResponse.json({ message: 'Invalid focusDate. Use YYYY-MM-DD.' }, { status: 400 });
    }
    try {
      const series = await getRevenueTrendSeriesEndingOnDay(prisma, bounds.start, 14);
      return NextResponse.json({ granularity: 'daily' as const, focusDate: focusRaw, series });
    } catch (e) {
      console.error('revenue-trends', e);
      return NextResponse.json({ message: 'Failed to load revenue trends' }, { status: 500 });
    }
  }

  const raw = searchParams.get('granularity') ?? 'monthly';
  if (!isRevenueGranularity(raw)) {
    return NextResponse.json(
      { message: 'Invalid granularity. Use daily, weekly, monthly, or yearly.' },
      { status: 400 },
    );
  }

  try {
    const series = await getRevenueTrendSeries(prisma, raw);
    return NextResponse.json({ granularity: raw, series });
  } catch (e) {
    console.error('revenue-trends', e);
    return NextResponse.json({ message: 'Failed to load revenue trends' }, { status: 500 });
  }
}
