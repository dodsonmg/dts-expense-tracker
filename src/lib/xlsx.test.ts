import { describe, it, expect } from 'vitest';
import { buildXlsx, xlsxFilename } from './xlsx';
import type { Expense } from '../types';

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

// Round-trip: write the workbook, read it back, assert on structure/values.
// Styling (colors) is intentionally not asserted.
async function readBack(buf: ArrayBuffer) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

function findRow(
  wb: Awaited<ReturnType<typeof readBack>>,
  sheet: string,
  firstCell: string,
) {
  const ws = wb.getWorksheet(sheet)!;
  let found: (string | number | null)[] | undefined;
  ws.eachRow((row) => {
    if (row.getCell(1).value === firstCell) {
      found = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
        (i) => row.getCell(i).value as string | number | null,
      );
    }
  });
  return found;
}

describe('buildXlsx', () => {
  it('has the expected filename', () => {
    expect(
      xlsxFilename('London Aug 2026', new Date('2026-07-04T12:00:00Z')),
    ).toBe('dts-expenses-london-aug-2026-2026-07-04.xlsx');
  });

  it('produces the three sheets with reconciliation tables and raw rows', async () => {
    const buf = await buildXlsx(
      [
        exp({
          category: 'LODGING',
          payment: 'GTCC',
          amount_gbp: 80,
          amount_usd: 100,
          note: 'hotel',
        }),
      ],
      [],
      { LODGING: 90 },
      { gtcc: 90, personal: null, total: null },
    );
    const wb = await readBack(buf);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Reconcile',
      'Expenses',
      'M&IE',
    ]);

    // Category reconcile row: label, GBP, USD, DTS, Δ, status
    const lodging = findRow(wb, 'Reconcile', 'LODGING');
    expect(lodging?.[2]).toBe(100); // USD app total
    expect(lodging?.[3]).toBe(90); // DTS
    expect(lodging?.[4]).toBe(10); // delta
    expect(lodging?.[5]).toBe('MISMATCH');

    // Account reimbursement row
    const gtcc = findRow(wb, 'Reconcile', 'GTCC');
    expect(gtcc?.[2]).toBe(100);
    expect(gtcc?.[5]).toBe('MISMATCH');

    // All-expenses Total row (unchecked here — no `total` DTS figure entered)
    const total = findRow(wb, 'Reconcile', 'Total');
    expect(total?.[2]).toBe(100);
    expect(total?.[5]).toBe(''); // unchecked, not mismatch

    // Raw expense row on the Expenses sheet
    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[1]).toBe('LODGING');
    expect(raw?.[2]).toBe(80); // GBP
    expect(raw?.[3]).toBe(100); // USD
  });

  it('flags a USD-incomplete category/account row and the pending expense row', async () => {
    const buf = await buildXlsx(
      [
        exp({
          category: 'LODGING',
          payment: 'GTCC',
          amount_gbp: 80,
          amount_usd: null, // USD pending
        }),
      ],
      [],
      { LODGING: 0 },
      { gtcc: 0, personal: null, total: null },
    );
    const wb = await readBack(buf);

    // Reconcile sheet: label, GBP, USD, DTS, Δ, status, USD Incomplete
    // (0-indexed array of 1-indexed columns, so found[i] = column i+1)
    const lodging = findRow(wb, 'Reconcile', 'LODGING');
    expect(lodging?.[2]).toBe(0); // USD app total is still 0, missing USD
    expect(lodging?.[6]).toBe('yes'); // USD Incomplete (column 7)
    const gtcc = findRow(wb, 'Reconcile', 'GTCC');
    expect(gtcc?.[6]).toBe('yes');
    const total = findRow(wb, 'Reconcile', 'Total');
    expect(total?.[6]).toBe('yes');

    // Expenses sheet: USD pending column (column 6) is flagged
    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[5]).toBe('yes');
  });

  it('reconciles the Total row independently and orders it ahead of GTCC/Personal', async () => {
    const buf = await buildXlsx(
      [
        exp({ category: 'LODGING', payment: 'GTCC', amount_usd: 500 }),
        exp({ category: 'TRANSPORT', payment: 'personal', amount_usd: 200 }),
      ],
      [],
      {},
      { gtcc: 500, personal: 200, total: 650 },
    );
    const wb = await readBack(buf);

    const total = findRow(wb, 'Reconcile', 'Total');
    expect(total?.[2]).toBe(700); // GTCC 500 + Personal 200
    expect(total?.[3]).toBe(650); // DTS
    expect(total?.[4]).toBe(50); // delta
    expect(total?.[5]).toBe('MISMATCH');

    const ws = wb.getWorksheet('Reconcile')!;
    const labels: string[] = [];
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      if (v === 'Total' || v === 'GTCC' || v === 'Personal') {
        labels.push(v as string);
      }
    });
    expect(labels).toEqual(['Total', 'GTCC', 'Personal']);
  });

  it('adds Miles/Rate columns to the Expenses sheet, populated only for MILEAGE rows', async () => {
    const buf = await buildXlsx(
      [
        exp({
          id: 'a',
          category: 'MILEAGE',
          amount_usd: 28.14,
          miles: 42,
          rate: 0.67,
          photoIds: [],
          note: 'leg 1',
        }),
      ],
      [],
    );
    const wb = await readBack(buf);

    // Expenses sheet: date, category, gbp, usd, payment, usd_pending,
    // entered, miles, rate, note -> indices 0-9
    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[7]).toBe(42); // Miles
    expect(raw?.[8]).toBe(0.67); // Rate
    expect(raw?.[9]).toBe('leg 1'); // Note still lands correctly after the shift
  });
});
