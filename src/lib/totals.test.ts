import { describe, it, expect } from 'vitest';
import {
  totalsByCategory,
  totalsByAccount,
  usdPendingCountsByCategory,
  usdPendingCountsByAccount,
} from './totals';
import { CATEGORIES, type Expense, type MieSegment } from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: null,
  amount_usd: null,
  payment: 'GTCC',
  note: '',
  entered: false,
  miles: null,
  rate: null,
  photoIds: [],
  ...over,
});

const mie: MieSegment = {
  id: 'm',
  location: 'base',
  full_rate: 100,
  partial_rate: 0,
  full_days: 2,
  partial_days: 0,
}; // 200 USD

describe('totalsByCategory', () => {
  it('returns rows in the fixed category order', () => {
    const rows = totalsByCategory([], []);
    expect(rows.map((r) => r.category)).toEqual([...CATEGORIES]);
  });

  it('keeps GBP and USD separate (never summed)', () => {
    const rows = totalsByCategory(
      [exp({ category: 'LODGING', amount_gbp: 80, amount_usd: 100 })],
      [],
    );
    const lodging = rows.find((r) => r.category === 'LODGING')!;
    expect(lodging.gbp).toBe(80);
    expect(lodging.usd).toBe(100);
  });

  it('treats missing amounts as zero', () => {
    const rows = totalsByCategory(
      [
        exp({ category: 'TRANSPORT', amount_gbp: 10, amount_usd: null }),
        exp({ category: 'TRANSPORT', amount_gbp: null, amount_usd: 25 }),
      ],
      [],
    );
    const t = rows.find((r) => r.category === 'TRANSPORT')!;
    expect(t.gbp).toBe(10);
    expect(t.usd).toBe(25);
  });

  it('feeds the M&IE row from segments as USD only', () => {
    const rows = totalsByCategory([], [mie]);
    const row = rows.find((r) => r.category === 'M&IE')!;
    expect(row.usd).toBe(200);
    expect(row.gbp).toBe(0);
  });
});

describe('totalsByAccount', () => {
  it('splits GTCC vs Personal, currencies separate', () => {
    const acct = totalsByAccount(
      [
        exp({ payment: 'GTCC', amount_gbp: 40, amount_usd: 50 }),
        exp({ payment: 'personal', amount_gbp: 10, amount_usd: 12 }),
      ],
      [],
    );
    expect(acct.gtcc).toEqual({ gbp: 40, usd: 50 });
    expect(acct.personal).toEqual({ gbp: 10, usd: 12 });
  });

  it('always routes M&IE to Personal (USD), never GTCC', () => {
    const acct = totalsByAccount([], [mie]);
    expect(acct.personal.usd).toBe(200);
    expect(acct.personal.gbp).toBe(0);
    expect(acct.gtcc).toEqual({ gbp: 0, usd: 0 });
  });
});

describe('usdPendingCountsByCategory', () => {
  it('counts USD-pending expenses per category, zero elsewhere', () => {
    const counts = usdPendingCountsByCategory([
      exp({ category: 'LODGING', amount_gbp: 80, amount_usd: null }),
      exp({ category: 'LODGING', amount_gbp: 20, amount_usd: null }),
      exp({ category: 'TRANSPORT', amount_gbp: 10, amount_usd: 12 }), // not pending
    ]);
    expect(counts.get('LODGING')).toBe(2);
    expect(counts.get('TRANSPORT')).toBe(0);
    expect(counts.get('M&IE')).toBe(0);
  });
});

describe('usdPendingCountsByAccount', () => {
  it('counts USD-pending expenses per account', () => {
    const counts = usdPendingCountsByAccount([
      exp({ payment: 'GTCC', amount_gbp: 80, amount_usd: null }),
      exp({ payment: 'personal', amount_gbp: 20, amount_usd: null }),
      exp({ payment: 'personal', amount_gbp: 10, amount_usd: 12 }), // not pending
    ]);
    expect(counts.gtcc).toBe(1);
    expect(counts.personal).toBe(1);
  });
});

describe('entered status is reconciliation metadata, not money', () => {
  it('does not change category or account totals', () => {
    const rows = [
      exp({ category: 'LODGING', amount_gbp: 80, amount_usd: 100, entered: false }),
      exp({ category: 'TRANSPORT', amount_usd: 25, payment: 'personal', entered: true }),
    ];
    const flipped = rows.map((e) => ({ ...e, entered: !e.entered }));

    expect(totalsByCategory(flipped, [mie])).toEqual(
      totalsByCategory(rows, [mie]),
    );
    expect(totalsByAccount(flipped, [mie])).toEqual(
      totalsByAccount(rows, [mie]),
    );
  });
});
