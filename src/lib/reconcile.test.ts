import { describe, it, expect } from 'vitest';
import { reconcileCategories, mismatchCount } from './reconcile';
import { CATEGORIES, type Category, type DtsExpected } from '../types';
import type { CategoryRow } from './totals';

// App-side category totals (defaults to 0/0 for categories not listed).
const appRows = (
  over: Partial<Record<Category, { gbp?: number; usd?: number }>> = {},
): CategoryRow[] =>
  CATEGORIES.map((category) => ({
    category,
    gbp: over[category]?.gbp ?? 0,
    usd: over[category]?.usd ?? 0,
  }));

// DTS-entered totals in the DtsExpected shape (fills the missing currency null).
const exp = (
  over: Partial<Record<Category, { gbp?: number | null; usd?: number | null }>>,
): DtsExpected =>
  Object.fromEntries(
    Object.entries(over).map(([k, v]) => [
      k,
      { gbp: v?.gbp ?? null, usd: v?.usd ?? null },
    ]),
  ) as DtsExpected;

const row = (
  rows: ReturnType<typeof reconcileCategories>,
  c: Category,
) => rows.find((r) => r.category === c)!;

describe('reconcileCategories', () => {
  it('matches when app equals DTS', () => {
    const rows = reconcileCategories(
      appRows({ LODGING: { gbp: 80, usd: 100 } }),
      exp({ LODGING: { gbp: 80, usd: 100 } }),
    );
    const l = row(rows, 'LODGING');
    expect(l.gbp.status).toBe('match');
    expect(l.gbp.delta).toBe(0);
    expect(l.usd.status).toBe('match');
  });

  it('tolerates sub-cent float noise but flags a real difference', () => {
    const near = reconcileCategories(
      appRows({ LODGING: { usd: 100 } }),
      exp({ LODGING: { usd: 100.004 } }),
    );
    expect(row(near, 'LODGING').usd.status).toBe('match');

    const off = reconcileCategories(
      appRows({ LODGING: { usd: 100 } }),
      exp({ LODGING: { usd: 100.01 } }),
    );
    expect(row(off, 'LODGING').usd.status).toBe('mismatch');
  });

  it('is unchecked when no DTS value has been entered', () => {
    const rows = reconcileCategories(appRows({ LODGING: { usd: 100 } }), {});
    const l = row(rows, 'LODGING');
    expect(l.usd.status).toBe('unchecked');
    expect(l.usd.dts).toBeNull();
    expect(l.usd.delta).toBeNull();
    expect(l.usd.app).toBe(100); // app total still reported
  });

  it('checks GBP and USD independently on the same row', () => {
    const rows = reconcileCategories(
      appRows({ LODGING: { gbp: 80, usd: 100 } }),
      exp({ LODGING: { gbp: 80, usd: 90 } }),
    );
    const l = row(rows, 'LODGING');
    expect(l.gbp.status).toBe('match');
    expect(l.usd.status).toBe('mismatch');
    expect(l.usd.delta).toBe(10); // app 100 - dts 90
  });

  it('reports a signed delta (app under DTS is negative)', () => {
    const rows = reconcileCategories(
      appRows({ TRANSPORT: { usd: 90 } }),
      exp({ TRANSPORT: { usd: 100 } }),
    );
    expect(row(rows, 'TRANSPORT').usd.delta).toBe(-10);
  });

  it('returns rows in the fixed category order', () => {
    expect(reconcileCategories(appRows(), {}).map((r) => r.category)).toEqual([
      ...CATEGORIES,
    ]);
  });

  it('reconciles the M&IE row (USD), leaving its GBP unchecked', () => {
    const rows = reconcileCategories(
      appRows({ 'M&IE': { usd: 200 } }),
      exp({ 'M&IE': { usd: 200 } }),
    );
    const m = row(rows, 'M&IE');
    expect(m.usd.status).toBe('match');
    expect(m.gbp.status).toBe('unchecked');
  });
});

describe('mismatchCount', () => {
  it('counts GBP and USD mismatches independently', () => {
    const rows = reconcileCategories(
      appRows({ LODGING: { gbp: 80, usd: 100 }, TRANSPORT: { usd: 50 } }),
      exp({ LODGING: { gbp: 70, usd: 90 }, TRANSPORT: { usd: 50 } }),
    );
    // LODGING: gbp + usd mismatch (2); TRANSPORT: usd match (0)
    expect(mismatchCount(rows)).toBe(2);
  });

  it('is zero when nothing has been checked', () => {
    expect(mismatchCount(reconcileCategories(appRows(), {}))).toBe(0);
  });
});
