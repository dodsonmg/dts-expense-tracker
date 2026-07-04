import {
  CATEGORIES,
  type Category,
  type Expense,
  type MieSegment,
} from '../types';
import { mieTotalUsd } from './mie';

// A GBP/USD pair. The two currencies are NEVER summed together (SPEC.md):
// every totals row keeps them in separate columns.
export interface CurrencyPair {
  gbp: number;
  usd: number;
}

export interface CategoryRow extends CurrencyPair {
  category: Category;
}

export interface AccountTotals {
  gtcc: CurrencyPair;
  personal: CurrencyPair;
}

const zero = (): CurrencyPair => ({ gbp: 0, usd: 0 });

// Totals by category, in the fixed category order. The M&IE row is fed from the
// per-diem calculator (USD only); it is never sourced from itemized rows.
export function totalsByCategory(
  expenses: Expense[],
  segments: MieSegment[],
): CategoryRow[] {
  const acc = new Map<Category, CurrencyPair>(
    CATEGORIES.map((c) => [c, zero()]),
  );

  for (const e of expenses) {
    const row = acc.get(e.category)!;
    row.gbp += e.amount_gbp ?? 0;
    row.usd += e.amount_usd ?? 0;
  }

  // M&IE is computed, USD only.
  acc.get('M&IE')!.usd += mieTotalUsd(segments);

  return CATEGORIES.map((category) => ({ category, ...acc.get(category)! }));
}

// Totals by account (GTCC vs Personal), used to verify the split disbursement.
// M&IE always counts toward Personal (USD).
export function totalsByAccount(
  expenses: Expense[],
  segments: MieSegment[],
): AccountTotals {
  const gtcc = zero();
  const personal = zero();

  for (const e of expenses) {
    const bucket = e.payment === 'GTCC' ? gtcc : personal;
    bucket.gbp += e.amount_gbp ?? 0;
    bucket.usd += e.amount_usd ?? 0;
  }

  personal.usd += mieTotalUsd(segments);

  return { gtcc, personal };
}
