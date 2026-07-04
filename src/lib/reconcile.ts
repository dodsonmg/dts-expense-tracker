import { CATEGORIES, type Category, type DtsExpected } from '../types';
import type { CategoryRow } from './totals';

// Comparison of the app's computed category totals against the totals the user
// read off DTS. GBP and USD are reconciled independently — never summed.

export type MatchStatus = 'match' | 'mismatch' | 'unchecked';

export interface CurrencyReconcile {
  app: number; // the app's computed total
  dts: number | null; // what the user entered from DTS (null = not checked)
  delta: number | null; // app - dts, null when unchecked
  status: MatchStatus;
}

export interface ReconcileRow {
  category: Category;
  gbp: CurrencyReconcile;
  usd: CurrencyReconcile;
}

// Money is compared at cent precision: differences below half a cent are float
// noise (e.g. 100.00 vs 100.004), not a real mismatch.
const CENT = 0.005;

function compare(app: number, dts: number | null): CurrencyReconcile {
  if (dts == null) return { app, dts: null, delta: null, status: 'unchecked' };
  const delta = app - dts;
  return { app, dts, delta, status: Math.abs(delta) < CENT ? 'match' : 'mismatch' };
}

// One reconcile row per category, in the fixed category order.
export function reconcileCategories(
  appRows: CategoryRow[],
  expected: DtsExpected,
): ReconcileRow[] {
  const byCat = new Map(appRows.map((r) => [r.category, r]));
  return CATEGORIES.map((category) => {
    const app = byCat.get(category) ?? { category, gbp: 0, usd: 0 };
    const exp = expected[category];
    return {
      category,
      gbp: compare(app.gbp, exp?.gbp ?? null),
      usd: compare(app.usd, exp?.usd ?? null),
    };
  });
}

// Total number of mismatched cells (GBP and USD counted independently).
export function mismatchCount(rows: ReconcileRow[]): number {
  return rows.reduce(
    (n, r) =>
      n +
      (r.gbp.status === 'mismatch' ? 1 : 0) +
      (r.usd.status === 'mismatch' ? 1 : 0),
    0,
  );
}
