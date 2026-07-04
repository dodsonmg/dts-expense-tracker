import type { Currency } from '../types';

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function money(amount: number | null, currency: Currency): string {
  if (amount == null) return '—';
  return (currency === 'GBP' ? gbp : usd).format(amount);
}

// Today's local date as YYYY-MM-DD (for the entry-form default).
export function today(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
