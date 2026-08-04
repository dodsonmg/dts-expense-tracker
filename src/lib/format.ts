import type { Currency } from '../types';

// Stands in for "whatever foreign currency is on the receipt" — the app
// doesn't track which one. Symbols only (no $), picked to read together at a
// glance. See HelpView's FAQ for the user-facing explanation.
export const FOREIGN_SYMBOL = '£€¥';

const foreign = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function money(amount: number | null, currency: Currency): string {
  if (amount == null) return '—';
  if (currency === 'USD') return usd.format(amount);
  return `${FOREIGN_SYMBOL}${foreign.format(amount)}`;
}

// Today's local date as YYYY-MM-DD (for the entry-form default).
export function today(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

// Turns a free-text trip name into a safe filename fragment, e.g.
// "London Aug 2026" -> "london-aug-2026". Falls back to "trip" for
// empty/all-punctuation/non-Latin input rather than producing an empty
// segment.
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'trip';
}
