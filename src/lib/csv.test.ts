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
  entered: false,
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
    // date,category,gbp,usd,payment,usd_pending,entered_in_dts,note
    expect(line).toBe('2026-07-01,LODGING,80.00,,GTCC,yes,,');
  });

  it('flags USD-pending rows (GBP present, USD absent)', () => {
    const csv = buildCsv([exp({ amount_gbp: 5, amount_usd: null })], []);
    expect(csv).toMatch(/,yes,/);
  });

  it('does not flag rows once USD is filled in', () => {
    const csv = buildCsv([exp({ amount_gbp: 5, amount_usd: 6 })], []);
    const line = csv.split('\r\n').find((l) => l.startsWith('2026-07-01'))!;
    // ...payment,usd_pending(blank),entered_in_dts(blank),note(blank)
    expect(line.endsWith(',GTCC,,,')).toBe(true);
  });

  it('has an entered_in_dts column and flags entered rows', () => {
    const header = buildCsv([], [])
      .split('\r\n')
      .find((l) => l.startsWith('date,'))!;
    expect(header).toContain('entered_in_dts');

    const csv = buildCsv(
      [
        exp({ id: 'a', amount_usd: 1, entered: true }),
        exp({ id: 'b', amount_usd: 2, entered: false }),
      ],
      [],
    );
    const rows = csv.split('\r\n').filter((l) => l.startsWith('2026-07-01'));
    // entered_in_dts is the 7th column (index 6)
    expect(rows[0].split(',')[6]).toBe('yes');
    expect(rows[1].split(',')[6]).toBe('');
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

const line = (csv: string, prefix: string) =>
  csv.split('\r\n').find((l) => l.startsWith(prefix))!;

describe('buildCsv — DTS comparison columns', () => {
  it('adds dts_usd/delta_usd/status headers to both totals blocks', () => {
    const csv = buildCsv([], []);
    const headers = csv
      .split('\r\n')
      .filter((l) => l.startsWith('category,') || l.startsWith('account,'));
    expect(headers).toEqual([
      'category,gbp,usd,dts_usd,delta_usd,status,usd_incomplete',
      'account,gbp,usd,dts_usd,delta_usd,status,usd_incomplete',
    ]);
  });

  it('flags a category mismatch as MISMATCH with a signed delta', () => {
    const csv = buildCsv(
      [exp({ category: 'LODGING', amount_usd: 100 })],
      [],
      { LODGING: 90 },
    );
    // category,gbp,usd,dts_usd,delta_usd,status,usd_incomplete
    expect(line(csv, 'LODGING,')).toBe(
      'LODGING,0.00,100.00,90.00,10.00,MISMATCH,',
    );
  });

  it('marks a matching category ok and leaves an unchecked one blank', () => {
    const matched = buildCsv(
      [exp({ category: 'LODGING', amount_usd: 100 })],
      [],
      { LODGING: 100 },
    );
    expect(line(matched, 'LODGING,')).toBe('LODGING,0.00,100.00,100.00,0.00,ok,');

    const unchecked = buildCsv([exp({ category: 'LODGING', amount_usd: 100 })], []);
    expect(line(unchecked, 'LODGING,')).toBe('LODGING,0.00,100.00,,,,');
  });

  it('reconciles the GTCC/Personal reimbursement in the account block', () => {
    const csv = buildCsv(
      [
        exp({ category: 'LODGING', payment: 'GTCC', amount_usd: 500 }),
        exp({ id: 'b', category: 'TRANSPORT', payment: 'personal', amount_usd: 200 }),
      ],
      [],
      {},
      { gtcc: 480, personal: 200 },
    );
    expect(line(csv, 'GTCC,')).toBe('GTCC,0.00,500.00,480.00,20.00,MISMATCH,');
    expect(line(csv, 'Personal,')).toBe('Personal,0.00,200.00,200.00,0.00,ok,');
  });

  it('flags usd_incomplete on a category/account fed by a USD-pending expense', () => {
    const csv = buildCsv(
      [exp({ category: 'LODGING', payment: 'GTCC', amount_gbp: 80, amount_usd: null })],
      [],
      { LODGING: 0 },
      { gtcc: 0, personal: null },
    );
    expect(line(csv, 'LODGING,')).toBe('LODGING,80.00,0.00,0.00,0.00,ok,yes');
    expect(line(csv, 'GTCC,')).toBe('GTCC,80.00,0.00,0.00,0.00,ok,yes');
  });
});

describe('csvFilename', () => {
  it('is dated YYYY-MM-DD', () => {
    expect(csvFilename(new Date('2026-07-04T12:00:00Z'))).toBe(
      'dts-expenses-2026-07-04.csv',
    );
  });
});
