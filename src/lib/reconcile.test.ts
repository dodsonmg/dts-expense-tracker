import { describe, it, expect } from 'vitest';
import {
  reconcileCategories,
  reconcileAccounts,
  reconcileAccountTotal,
  mismatchCount,
} from './reconcile';
import { CATEGORIES, type Category } from '../types';
import type { AccountTotals, CategoryRow } from './totals';

// App-side category USD totals (0 for categories not listed).
const appRows = (over: Partial<Record<Category, number>> = {}): CategoryRow[] =>
  CATEGORIES.map((category) => ({
    category,
    gbp: 0,
    usd: over[category] ?? 0,
  }));

const catRow = (
  rows: ReturnType<typeof reconcileCategories>,
  c: Category,
) => rows.find((r) => r.category === c)!;

describe('reconcileCategories (USD only)', () => {
  it('matches when app equals DTS', () => {
    const rows = reconcileCategories(appRows({ LODGING: 100 }), {
      LODGING: 100,
    });
    expect(catRow(rows, 'LODGING').usd.status).toBe('match');
    expect(catRow(rows, 'LODGING').usd.delta).toBe(0);
  });

  it('tolerates sub-cent float noise but flags a real difference', () => {
    const near = reconcileCategories(appRows({ LODGING: 100 }), {
      LODGING: 100.004,
    });
    expect(catRow(near, 'LODGING').usd.status).toBe('match');

    const off = reconcileCategories(appRows({ LODGING: 100 }), {
      LODGING: 100.01,
    });
    expect(catRow(off, 'LODGING').usd.status).toBe('mismatch');
  });

  it('is unchecked when no DTS value has been entered', () => {
    const rows = reconcileCategories(appRows({ LODGING: 100 }), {});
    const l = catRow(rows, 'LODGING').usd;
    expect(l.status).toBe('unchecked');
    expect(l.dts).toBeNull();
    expect(l.delta).toBeNull();
    expect(l.app).toBe(100); // app total still reported
  });

  it('reports a signed delta (app under DTS is negative)', () => {
    const over = reconcileCategories(appRows({ TRANSPORT: 100 }), {
      TRANSPORT: 90,
    });
    expect(catRow(over, 'TRANSPORT').usd.delta).toBe(10);

    const under = reconcileCategories(appRows({ TRANSPORT: 90 }), {
      TRANSPORT: 100,
    });
    expect(catRow(under, 'TRANSPORT').usd.delta).toBe(-10);
  });

  it('returns rows in the fixed category order', () => {
    expect(reconcileCategories(appRows(), {}).map((r) => r.category)).toEqual([
      ...CATEGORIES,
    ]);
  });

  it('reconciles the M&IE row', () => {
    const rows = reconcileCategories(appRows({ 'M&IE': 200 }), { 'M&IE': 200 });
    expect(catRow(rows, 'M&IE').usd.status).toBe('match');
  });
});

const accounts = (gtcc: number, personal: number): AccountTotals => ({
  gtcc: { gbp: 0, usd: gtcc },
  personal: { gbp: 0, usd: personal },
});

describe('reconcileAccounts (USD reimbursement)', () => {
  it('checks GTCC and Personal independently', () => {
    const rows = reconcileAccounts(accounts(500, 200), {
      gtcc: 500,
      personal: 180,
      total: null,
    });
    const gtcc = rows.find((r) => r.account === 'gtcc')!.usd;
    const personal = rows.find((r) => r.account === 'personal')!.usd;
    expect(gtcc.status).toBe('match');
    expect(personal.status).toBe('mismatch');
    expect(personal.delta).toBe(20); // app 200 - dts 180
  });

  it('is unchecked when a reimbursement total is blank', () => {
    const rows = reconcileAccounts(accounts(500, 200), {
      gtcc: null,
      personal: null,
      total: null,
    });
    expect(rows.every((r) => r.usd.status === 'unchecked')).toBe(true);
  });
});

describe('reconcileAccountTotal (USD grand total)', () => {
  it('reconciles GTCC + Personal independently of the split', () => {
    const rec = reconcileAccountTotal(accounts(500, 200), {
      gtcc: null,
      personal: null,
      total: 650,
    });
    expect(rec.app).toBe(700);
    expect(rec.status).toBe('mismatch');
    expect(rec.delta).toBe(50); // app 700 - dts 650
  });

  it('is unchecked when the total is blank', () => {
    const rec = reconcileAccountTotal(accounts(500, 200), {
      gtcc: 500,
      personal: 200,
      total: null,
    });
    expect(rec.status).toBe('unchecked');
  });
});

describe('mismatchCount', () => {
  it('counts USD mismatches across the rows given', () => {
    const cats = reconcileCategories(
      appRows({ LODGING: 100, TRANSPORT: 50 }),
      { LODGING: 90, TRANSPORT: 50 },
    );
    const accts = reconcileAccounts(accounts(500, 200), {
      gtcc: 480,
      personal: 200,
      total: null,
    });
    expect(mismatchCount(cats)).toBe(1); // LODGING only
    expect(mismatchCount(accts)).toBe(1); // GTCC only
  });
});
