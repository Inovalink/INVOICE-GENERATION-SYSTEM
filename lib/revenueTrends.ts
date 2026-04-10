import type { PrismaClient } from '@prisma/client';
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  endOfDay,
  endOfWeek,
  format,
  getYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';

export type RevenueGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RevenueTrendPoint = {
  key: string;
  label: string;
  amount: number;
};

const GRANULARITIES: RevenueGranularity[] = ['daily', 'weekly', 'monthly', 'yearly'];

export function isRevenueGranularity(value: unknown): value is RevenueGranularity {
  return typeof value === 'string' && (GRANULARITIES as string[]).includes(value);
}

function bucketKeyForPayment(d: Date, granularity: RevenueGranularity): string {
  switch (granularity) {
    case 'daily':
      return format(startOfDay(d), 'yyyy-MM-dd');
    case 'weekly':
      return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    case 'monthly':
      return format(startOfMonth(d), 'yyyy-MM');
    case 'yearly':
      return String(getYear(d));
    default:
      return format(startOfDay(d), 'yyyy-MM-dd');
  }
}

function labelForBucketStart(d: Date, granularity: RevenueGranularity): string {
  switch (granularity) {
    case 'daily':
      return format(d, 'MMM d');
    case 'weekly': {
      const wEnd = endOfWeek(d, { weekStartsOn: 1 });
      return `${format(d, 'MMM d')} – ${format(wEnd, 'MMM d')}`;
    }
    case 'monthly':
      return format(d, 'MMM yyyy');
    case 'yearly':
      return format(d, 'yyyy');
    default:
      return format(d, 'MMM d');
  }
}

function orderedBucketStarts(now: Date, granularity: RevenueGranularity): Date[] {
  switch (granularity) {
    case 'daily': {
      const end = startOfDay(now);
      const start = startOfDay(subDays(now, 29));
      return eachDayOfInterval({ start, end });
    }
    case 'weekly': {
      const end = startOfWeek(now, { weekStartsOn: 1 });
      const start = startOfWeek(subWeeks(now, 11), { weekStartsOn: 1 });
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    }
    case 'monthly': {
      const end = startOfMonth(now);
      const start = startOfMonth(subMonths(now, 11));
      return eachMonthOfInterval({ start, end });
    }
    case 'yearly': {
      const end = startOfYear(now);
      const start = startOfYear(subYears(now, 5));
      return eachYearOfInterval({ start, end });
    }
    default:
      return [];
  }
}

function bucketKeyFromStart(bucketStart: Date, granularity: RevenueGranularity): string {
  switch (granularity) {
    case 'daily':
      return format(bucketStart, 'yyyy-MM-dd');
    case 'weekly':
      return format(bucketStart, 'yyyy-MM-dd');
    case 'monthly':
      return format(bucketStart, 'yyyy-MM');
    case 'yearly':
      return String(getYear(bucketStart));
    default:
      return format(bucketStart, 'yyyy-MM-dd');
  }
}

/**
 * Payment-based revenue by period (local calendar). Buckets are zero-filled for periods with no payments.
 */
export async function getRevenueTrendSeries(
  prisma: PrismaClient,
  granularity: RevenueGranularity,
): Promise<RevenueTrendPoint[]> {
  const now = new Date();
  const bucketStarts = orderedBucketStarts(now, granularity);
  if (bucketStarts.length === 0) return [];

  const rangeStart = bucketStarts[0];
  const rangeEnd = endOfDay(now);

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: rangeStart, lte: rangeEnd },
    },
    select: { amount: true, paymentDate: true },
  });

  const sums = new Map<string, number>();
  for (const p of payments) {
    const key = bucketKeyForPayment(p.paymentDate, granularity);
    sums.set(key, (sums.get(key) ?? 0) + (p.amount ?? 0));
  }

  return bucketStarts.map((bucketStart) => {
    const key = bucketKeyFromStart(bucketStart, granularity);
    return {
      key,
      label: labelForBucketStart(bucketStart, granularity),
      amount: sums.get(key) ?? 0,
    };
  });
}

/** Last `numDays` calendar days ending on `endDay` (local), daily payment totals. */
export async function getRevenueTrendSeriesEndingOnDay(
  prisma: PrismaClient,
  endDay: Date,
  numDays: number,
): Promise<RevenueTrendPoint[]> {
  const end = startOfDay(endDay);
  const start = startOfDay(subDays(end, numDays - 1));
  const days = eachDayOfInterval({ start, end });

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: start, lte: endOfDay(end) },
    },
    select: { amount: true, paymentDate: true },
  });

  const sums = new Map<string, number>();
  for (const p of payments) {
    const key = bucketKeyForPayment(p.paymentDate, 'daily');
    sums.set(key, (sums.get(key) ?? 0) + (p.amount ?? 0));
  }

  return days.map((bucketStart) => {
    const key = format(bucketStart, 'yyyy-MM-dd');
    return {
      key,
      label: format(bucketStart, 'MMM d'),
      amount: sums.get(key) ?? 0,
    };
  });
}
