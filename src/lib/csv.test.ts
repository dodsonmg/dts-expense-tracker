import { describe, it, expect } from 'vitest';
import { buildCsv, csvFilename } from './csv';
import type { Expense, MieSegment } from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: null,
  amount_usd: null,
  payment: 'GTCC',
  note: '',
  ...over,
});

describe('buildCsv', () => {
  it('emits the four sections in order', () => {
    const csv = buildCsv([], []);
    const iExp = csv.indexOf('EXPENSES');
    const iSeg = csv.indexOf('M&IE SEGMENTS');
    const iCat = csv.indexOf('TOTALS BY CATEGORY');
    const iAcc = csv.indexOf('TOTALS BY ACCOUNT');
    expect(iExp).toBeGreaterThanOrEqual(0);
    expect(iExp).toBeLessThan(iSeg);
    expect(iSeg).toBeLessThan(iCat);
    expect(iCat).toBeLessThan(iAcc);
  });

  it('writes money as plain 2-dp numbers, blank when absent', () => {
    const csv = buildCsv(
      [exp({ amount_gbp: 80, amount_usd: null, payment: 'GTCC' })],
      [],
    );
    const line = csv
      .split('\r\n')
      .find((l) => l.startsWith('2026-07-01'))!;
    // date,category,gbp,usd,payment,usd_pending,note
    expect(line).toBe('2026-07-01,LODGING,80.00,,GTCC,yes,');
  });

  it('flags USD-pending rows (GBP present, USD absent)', () => {
    const csv = buildCsv([exp({ amount_gbp: 5, amount_usd: null })], []);
    expect(csv).toMatch(/,yes,/);
  });

  it('does not flag rows once USD is filled in', () => {
    const csv = buildCsv([exp({ amount_gbp: 5, amount_usd: 6 })], []);
    const line = csv.split('\r\n').find((l) => l.startsWith('2026-07-01'))!;
    expect(line.endsWith(',GTCC,,')).toBe(true);
  });

  it('escapes commas and quotes in notes', () => {
    const csv = buildCsv(
      [exp({ amount_usd: 1, note: 'taxi, "receipt" #4' })],
      [],
    );
    expect(csv).toContain('"taxi, ""receipt"" #4"');
  });

  it('includes the M&IE total in the segments block', () => {
    const seg: MieSegment = {
      id: 'm',
      location: 'base',
      full_rate: 100,
      partial_rate: 0,
      full_days: 2,
      partial_days: 0,
    };
    const csv = buildCsv([], [seg]);
    expect(csv).toContain('M&IE TOTAL');
    expect(csv).toContain('200.00');
  });
});

describe('csvFilename', () => {
  it('is dated YYYY-MM-DD', () => {
    expect(csvFilename(new Date('2026-07-04T12:00:00Z'))).toBe(
      'dts-expenses-2026-07-04.csv',
    );
  });
});
