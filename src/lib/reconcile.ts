import {
  CATEGORIES,
  type Account,
  type Category,
  type DtsAccountExpected,
  type DtsExpected,
} from '../types';
import type { AccountTotals, CategoryRow } from './totals';

// Compares the app's computed USD totals against the USD totals the user read
// off DTS. DTS is USD-only, so reconciliation is USD-only — GBP receipt amounts
// are matched to USD entries at the expense level, not here.

export type MatchStatus = 'match' | 'mismatch' | 'unchecked';

export interface Reconcile {
  app: number; // the app's computed USD total
  dts: number | null; // what the user entered from DTS (null = not checked)
  delta: number | null; // app - dts, null when unchecked
  status: MatchStatus;
}

// Money is compared at cent precision: differences below half a cent are float
// noise (e.g. 100.00 vs 100.004), not a real mismatch.
const CENT = 0.005;

function compare(app: number, dts: number | null): Reconcile {
  if (dts == null) return { app, dts: null, delta: null, status: 'unchecked' };
  const delta = app - dts;
  return { app, dts, delta, status: Math.abs(delta) < CENT ? 'match' : 'mismatch' };
}

export interface CategoryReconcile {
  category: Category;
  usd: Reconcile;
}

// One reconcile row per category, in the fixed category order.
export function reconcileCategories(
  appRows: CategoryRow[],
  expected: DtsExpected,
): CategoryReconcile[] {
  const byCat = new Map(appRows.map((r) => [r.category, r]));
  return CATEGORIES.map((category) => ({
    category,
    usd: compare(byCat.get(category)?.usd ?? 0, expected[category] ?? null),
  }));
}

export interface AccountReconcile {
  account: Account;
  usd: Reconcile;
}

// Reconcile the split reimbursement: GTCC (repays the card) vs Personal.
export function reconcileAccounts(
  app: AccountTotals,
  expected: DtsAccountExpected,
): AccountReconcile[] {
  return [
    { account: 'gtcc', usd: compare(app.gtcc.usd, expected.gtcc) },
    { account: 'personal', usd: compare(app.personal.usd, expected.personal) },
  ];
}

// Count of mismatched USD cells across the given reconcile rows.
export function mismatchCount(
  rows: { usd: Reconcile }[],
): number {
  return rows.reduce((n, r) => n + (r.usd.status === 'mismatch' ? 1 : 0), 0);
}
