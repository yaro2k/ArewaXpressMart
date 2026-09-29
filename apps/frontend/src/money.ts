/** Formats a server-provided integer minor-unit amount for display only. */
export function formatMoney(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Money amount must be a safe integer in minor units.');
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
}
