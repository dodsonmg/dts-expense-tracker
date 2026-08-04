import { describe, it, expect } from 'vitest';
import { buildReport } from './report';
import type { Expense, MieSegment } from '../types';

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

describe('buildReport', () => {
  it('maps expense flags (usd pending, entered)', () => {
    const r = buildReport(
      [exp({ amount_gbp: 5, amount_usd: null, entered: false })],
      [],
    );
    expect(r.expenses[0].usdPending).toBe(true);
    expect(r.expenses[0].entered).toBe(false);
  });

  it('carries the USD reconciliation per category', () => {
    const r = buildReport([exp({ category: 'LODGING', amount_usd: 100 })], [], {
      LODGING: 90,
    });
    const l = r.categories.find((c) => c.category === 'LODGING')!;
    expect(l.usd).toBe(100);
    expect(l.recon.status).toBe('mismatch');
    expect(l.recon.delta).toBe(10);
  });

  it('carries account reimbursement reconciliation with labels', () => {
    const r = buildReport(
      [exp({ payment: 'GTCC', amount_usd: 500 })],
      [],
      {},
      { gtcc: 480, personal: null, total: null },
    );
    const g = r.accounts.find((a) => a.account === 'gtcc')!;
    expect(g.label).toBe('GTCC');
    expect(g.usd).toBe(500);
    expect(g.recon.status).toBe('mismatch');
    const p = r.accounts.find((a) => a.account === 'personal')!;
    expect(p.recon.status).toBe('unchecked');
  });

  it('carries the all-expenses Total, reconciled independently of the split', () => {
    const r = buildReport(
      [
        exp({ payment: 'GTCC', amount_usd: 500 }),
        exp({ payment: 'personal', amount_usd: 200 }),
      ],
      [],
      {},
      { gtcc: 500, personal: 200, total: 650 },
    );
    expect(r.accountTotal.label).toBe('Total');
    expect(r.accountTotal.usd).toBe(700);
    expect(r.accountTotal.recon.status).toBe('mismatch');
    expect(r.accountTotal.recon.delta).toBe(50); // app 700 - dts 650
  });

  it('flags a category/account row as USD-incomplete when it includes a pending expense', () => {
    const r = buildReport(
      [
        exp({ category: 'LODGING', payment: 'GTCC', amount_gbp: 80, amount_usd: null }),
        exp({ category: 'TRANSPORT', payment: 'personal', amount_usd: 25 }),
      ],
      [],
    );
    const lodging = r.categories.find((c) => c.category === 'LODGING')!;
    const transport = r.categories.find((c) => c.category === 'TRANSPORT')!;
    expect(lodging.usdPendingCount).toBe(1);
    expect(transport.usdPendingCount).toBe(0);

    const gtcc = r.accounts.find((a) => a.account === 'gtcc')!;
    const personal = r.accounts.find((a) => a.account === 'personal')!;
    expect(gtcc.usdPendingCount).toBe(1);
    expect(personal.usdPendingCount).toBe(0);
  });

  it('passes through miles/rate for MILEAGE rows, null for others', () => {
    const r = buildReport(
      [
        exp({ category: 'MILEAGE', amount_usd: 28.14, miles: 42, rate: 0.67 }),
        exp({ category: 'LODGING', amount_usd: 100 }),
      ],
      [],
    );
    expect(r.expenses[0]).toMatchObject({ miles: 42, rate: 0.67 });
    expect(r.expenses[1]).toMatchObject({ miles: null, rate: null });
  });

  it('computes segment totals and the M&IE total/row', () => {
    const seg: MieSegment = {
      id: 'm',
      location: 'base',
      full_rate: 100,
      partial_rate: 0,
      full_days: 2,
      partial_days: 0,
    };
    const r = buildReport([], [seg]);
    expect(r.segments[0].usd).toBe(200);
    expect(r.mieTotalUsd).toBe(200);
    expect(r.categories.find((c) => c.category === 'M&IE')!.usd).toBe(200);
  });
});
