/** Aligns with checkout labels in `InvoicesTable`; MOBILE_MONEY provider is stored in `payment.notes` by the pay API. */

export type PaymentDisplayFields = {
  paymentMethod: string;
  notes: string | null;
  transactionRef?: string | null;
};

export function formatPaymentMethodEnum(raw: string): string {
  const map: Record<string, string> = {
    CASH: 'Cash',
    BANK_TRANSFER: 'Bank transfer',
    MOBILE_MONEY: 'Mobile Money',
    CREDIT_CARD: 'Credit card',
    OTHER: 'Other',
  };
  return map[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPaymentMethodTitle(payment: PaymentDisplayFields): string {
  const notes = payment.notes?.trim() ?? '';
  if (payment.paymentMethod === 'MOBILE_MONEY') {
    if (notes.startsWith('MTN Momo')) return 'MTN Momo';
    if (notes.startsWith('Telecel Cash')) return 'Telecel Cash';
    return 'Mobile Money';
  }
  return formatPaymentMethodEnum(payment.paymentMethod);
}

export function getPaymentMethodSubtext(
  payment: PaymentDisplayFields & { transactionRef: string | null },
  clientName: string
): string | null {
  const notes = payment.notes?.trim() ?? '';
  const ref = payment.transactionRef?.trim();

  if (payment.paymentMethod === 'MOBILE_MONEY') {
    if (ref && clientName) return `${ref} - ${clientName}`;
    if (ref) return ref;
    return null;
  }

  if (payment.paymentMethod === 'BANK_TRANSFER') {
    const m = notes.match(/^Bank transfer \((.+)\)\s*$/);
    if (m) return m[1];
    return notes || null;
  }

  if (payment.paymentMethod === 'CASH') {
    return notes || null;
  }

  if (ref && clientName) return `${ref} - ${clientName}`;
  if (ref) return ref;
  if (notes) return notes;
  if (clientName) return clientName;
  return null;
}
