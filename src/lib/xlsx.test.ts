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
      found = [1, 2, 3, 4, 5, 6, 7, 8].map(
        (i) => row.getCell(i).value as string | number | null,
      );
    }
  });
  return found;
}

describe('buildXlsx', () => {
  it('has the expected filename', () => {
    expect(xlsxFilename(new Date('2026-07-04T12:00:00Z'))).toBe(
      'dts-expenses-2026-07-04.xlsx',
    );
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
      { gtcc: 90, personal: null },
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
      { gtcc: 0, personal: null },
    );
    const wb = await readBack(buf);

    // Reconcile sheet: label, GBP, USD, DTS, Δ, status, USD Incomplete
    // (0-indexed array of 1-indexed columns, so found[i] = column i+1)
    const lodging = findRow(wb, 'Reconcile', 'LODGING');
    expect(lodging?.[2]).toBe(0); // USD app total is still 0, missing USD
    expect(lodging?.[6]).toBe('yes'); // USD Incomplete (column 7)
    const gtcc = findRow(wb, 'Reconcile', 'GTCC');
    expect(gtcc?.[6]).toBe('yes');

    // Expenses sheet: USD pending column (column 6) is flagged
    const raw = findRow(wb, 'Expenses', '2026-07-01');
    expect(raw?.[5]).toBe('yes');
  });
});
