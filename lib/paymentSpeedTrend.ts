import type { PrismaClient } from '@prisma/client';
import {
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';

export type PaymentSpeedTrendGranularity = 'weekly' | 'monthly';

export type PaymentSpeedTrendPoint = {
  key: string;
  label: string;
  /** Mean calendar days from issue date to last payment date for invoices completed in this period. */
  averageDays: number;
  paidInvoiceCount: number;
};

const GRANULARITIES: PaymentSpeedTrendGranularity[] = ['weekly', 'monthly'];

export function isPaymentSpeedTrendGranularity(
  value: unknown,
): value is PaymentSpeedTrendGranularity {
  return typeof value === 'string' && (GRANULARITIES as string[]).includes(value);
}

function calendarDaysBetween(issueDate: Date, paymentDate: Date): number {
  const a = Date.UTC(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate());
  const b = Date.UTC(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
  return Math.round((b - a) / 86400000);
}

function bucketStartForPaymentDate(
  paymentDate: Date,
  granularity: PaymentSpeedTrendGranularity,
): Date {
  return granularity === 'monthly'
    ? startOfMonth(paymentDate)
    : startOfWeek(paymentDate, { weekStartsOn: 1 });
}

function bucketKey(bucketStart: Date, granularity: PaymentSpeedTrendGranularity): string {
  return granularity === 'monthly'
    ? format(bucketStart, 'yyyy-MM')
    : format(bucketStart, 'yyyy-MM-dd');
}

function labelForBucket(bucketStart: Date, granularity: PaymentSpeedTrendGranularity): string {
  if (granularity === 'monthly') {
    return format(bucketStart, 'MMM yyyy');
  }
  const wEnd = endOfWeek(bucketStart, { weekStartsOn: 1 });
  return `${format(bucketStart, 'MMM d')} – ${format(wEnd, 'MMM d, yyyy')}`;
}

/**
 * Buckets each paid invoice by **last payment date** (when payment completed).
 * Averages `paymentDays` (issue → last payment) per week or month.
 * Lookback: last 52 weeks or last 24 months (including current period).
 */
export async function getPaymentSpeedTrendSeries(
  prisma: PrismaClient,
  options: { granularity: PaymentSpeedTrendGranularity },
): Promise<PaymentSpeedTrendPoint[]> {
  const { granularity } = options;
  const now = new Date();

  const windowStart =
    granularity === 'monthly'
      ? startOfMonth(subMonths(now, 23))
      : startOfWeek(subWeeks(now, 51), { weekStartsOn: 1 });

  const invoices = await prisma.invoice.findMany({
    where: { status: 'PAID' },
    select: {
      issueDate: true,
      payments: { select: { paymentDate: true } },
    },
  });

  type Agg = { sumDays: number; count: number; label: string };
  const map = new Map<string, Agg>();

  for (const inv of invoices) {
    if (inv.payments.length === 0) continue;
    const lastPayment = inv.payments.reduce(
      (latest, p) => (p.paymentDate > latest ? p.paymentDate : latest),
      inv.payments[0].paymentDate,
    );
    if (lastPayment < windowStart) continue;

    const paymentDays = calendarDaysBetween(inv.issueDate, lastPayment);
    const bucketStart = bucketStartForPaymentDate(lastPayment, granularity);
    const key = bucketKey(bucketStart, granularity);
    const label = labelForBucket(bucketStart, granularity);

    const cur = map.get(key);
    if (cur) {
      cur.sumDays += paymentDays;
      cur.count += 1;
    } else {
      map.set(key, { sumDays: paymentDays, count: 1, label });
    }
  }

  const keys = [...map.keys()].sort();
  return keys.map((key) => {
    const agg = map.get(key)!;
    const averageDays = Math.round((agg.sumDays / agg.count) * 10) / 10;
    return {
      key,
      label: agg.label,
      averageDays,
      paidInvoiceCount: agg.count,
    };
  });
}
