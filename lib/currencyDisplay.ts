const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  GHS: '₵',
  NGN: '₦',
};

/** Symbol shown before amounts in forms and invoice preview (matches currency dropdown). */
export function getCurrencySymbol(currencyCode: string): string {
  const code = currencyCode?.trim().toUpperCase() ?? '';
  return CURRENCY_SYMBOLS[code] ?? `${code || '?'} `;
}
