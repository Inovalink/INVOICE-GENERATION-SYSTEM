/**
 * Unpaid invoice whose calendar due date is strictly before today (local time).
 */
export function isInvoiceOverdue(params: {
  status: string;
  paymentStatus: string | null | undefined;
  dueDate: string | Date | null | undefined;
  amountDue?: number;
  total?: number;
  depositAmount?: number;
}): boolean {
  const { status, paymentStatus, dueDate, amountDue, total, depositAmount } = params;
  if (status === 'PAID' || status === 'CANCELLED') return false;
  /* Proforma is a quote / intent to invoice — not subject to payment-overdue rules */
  if (status === 'PROFORMA') return false;
  if (paymentStatus === 'paid') return false;
  if (!dueDate) return false;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  if (dueDay >= today) return false;
  const outstanding =
    typeof total === 'number' && typeof depositAmount === 'number'
      ? Math.max(0, total - depositAmount)
      : amountDue;
  if (outstanding !== undefined && outstanding <= 0) return false;
  return true;
}

/** Overdue as of the start of `asOfDay` (local midnight): due strictly before that day, still unpaid. */
export function isInvoiceOverdueAsOf(
  params: {
    status: string;
    paymentStatus: string | null | undefined;
    dueDate: string | Date | null | undefined;
    amountDue?: number;
    total?: number;
    depositAmount?: number;
  },
  asOfDayStart: Date,
): boolean {
  const { status, paymentStatus, dueDate, amountDue, total, depositAmount } = params;
  if (status === 'PAID' || status === 'CANCELLED') return false;
  if (status === 'PROFORMA') return false;
  if (paymentStatus === 'paid') return false;
  if (!dueDate) return false;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) return false;
  const ref = new Date(asOfDayStart);
  ref.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  if (dueDay.getTime() >= ref.getTime()) return false;
  const outstanding =
    typeof total === 'number' && typeof depositAmount === 'number'
      ? Math.max(0, total - depositAmount)
      : amountDue;
  if (outstanding !== undefined && outstanding <= 0) return false;
  return true;
}

export function invoiceDisplayStatus(inv: {
  status: string;
  paymentStatus: string | null | undefined;
  dueDate: string | Date | null | undefined;
  amountDue: number;
  total?: number;
  depositAmount?: number;
}): string {
  if (isInvoiceOverdue(inv)) return 'OVERDUE';
  return inv.status;
}

/** Whole days between due date (start of day) and today (start of day), minimum 1. */
export function daysOverdueFromDueDate(dueDate: string | Date): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

export type OverdueRiskLevel = 'low' | 'medium' | 'high';

/**
 * Risk from calendar days past due (start-of-day): 1 day = low, 2–4 = medium, 5+ = high.
 */
export function overdueRiskFromDaysOverdue(daysOverdue: number): OverdueRiskLevel {
  const d = Math.max(1, Math.floor(Number(daysOverdue)));
  if (d === 1) return 'low';
  if (d <= 4) return 'medium';
  return 'high';
}

export function overdueRiskDisplayLabel(level: OverdueRiskLevel): string {
  if (level === 'low') return 'Low risk';
  if (level === 'medium') return 'Medium risk';
  return 'High risk';
}
