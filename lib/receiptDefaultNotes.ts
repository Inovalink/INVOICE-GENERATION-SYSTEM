/**
 * Canonical thank-you line for receipts. New payments persist this to `Receipt.notes`.
 * The receipt modal and GET `/api/receipts/:id` always expose this string for display so
 * copy updates apply without migrating older rows.
 */
export const RECEIPT_DEFAULT_NOTE =
  'Thank you for your payment — we truly appreciate your business and continued trust.';
