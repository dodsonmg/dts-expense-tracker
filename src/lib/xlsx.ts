import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import {
  buildReport,
  type ReportCategoryRow,
  type ReportAccountRow,
  type ReportTotalRow,
} from './report';
import type { MatchStatus, Reconcile } from './reconcile';
import { slugify } from './format';

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function xlsxFilename(tripName: string, now = new Date()): string {
  return `dts-expenses-${slugify(tripName)}-${now.toISOString().slice(0, 10)}.xlsx`;
}

const MONEY_FMT = '#,##0.00';
// as const keeps the literal types ExcelJS's Fill union expects.
const headFill = () =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF4' } }) as const;
const mismatchFill = () =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7D6D6' } }) as const;
// Yellow: USD-pending data makes the row's comparison premature. Takes
// precedence over the red mismatch fill (see #14) — a mismatch built on an
// incomplete total isn't a reliable signal yet.
const pendingFill = () =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7EFC0' } }) as const;

function statusText(s: MatchStatus): string {
  return s === 'mismatch' ? 'MISMATCH' : s === 'match' ? 'ok' : '';
}

// A formatted workbook whose first sheet puts the reconciliation tables up top
// (highlighting mismatches), with the raw rows and M&IE breakdown behind it.
// ExcelJS is heavy, so it's dynamically imported here to stay out of the main
// bundle; the split chunk is still precached for offline export.
export async function buildXlsx(
  expenses: Expense[],
  segments: MieSegment[],
  expected: DtsExpected = {},
  accountExpected: DtsAccountExpected = { gtcc: null, personal: null, total: null },
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const report = buildReport(expenses, segments, expected, accountExpected);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DTS Expense Tracker';
  wb.created = new Date();

  // --- Reconcile sheet: tables at the top ---
  const rec = wb.addWorksheet('Reconcile');
  rec.columns = [16, 12, 12, 12, 12, 12, 14].map((width) => ({ width }));

  const title = rec.addRow(['DTS Expense Reconciliation']);
  title.font = { bold: true, size: 14 };
  rec.addRow([`Exported ${new Date().toISOString().slice(0, 10)} · USD`]);

  const addReconTable = (
    heading: string,
    firstCol: string,
    rows: (ReportCategoryRow | ReportAccountRow | ReportTotalRow)[],
    labelOf: (r: ReportCategoryRow | ReportAccountRow | ReportTotalRow) => string,
  ) => {
    rec.addRow([]);
    rec.addRow([heading]).font = { bold: true };

    const header = rec.addRow([
      firstCol,
      'GBP',
      'USD',
      'DTS USD',
      'Δ USD',
      'Status',
      'USD Incomplete',
    ]);
    header.font = { bold: true };
    for (let i = 1; i <= 7; i++) header.getCell(i).fill = headFill();

    for (const r of rows) {
      const rec2: Reconcile = r.recon;
      const incomplete = r.usdPendingCount > 0;
      const row = rec.addRow([
        labelOf(r),
        r.gbp,
        r.usd,
        rec2.dts,
        rec2.delta,
        statusText(rec2.status),
        incomplete ? 'yes' : '',
      ]);
      for (const c of [2, 3, 4, 5]) row.getCell(c).numFmt = MONEY_FMT;
      if (incomplete) {
        for (let i = 1; i <= 7; i++) row.getCell(i).fill = pendingFill();
      } else if (rec2.status === 'mismatch') {
        for (let i = 1; i <= 7; i++) row.getCell(i).fill = mismatchFill();
      }
    }
  };

  addReconTable(
    'By category (vs DTS)',
    'Category',
    report.categories,
    (r) => (r as ReportCategoryRow).category,
  );
  addReconTable(
    'By account (reimbursement)',
    'Account',
    [report.accountTotal, ...report.accounts],
    (r) => (r as ReportAccountRow | ReportTotalRow).label,
  );

  // --- Expenses sheet: raw rows ---
  const exp = wb.addWorksheet('Expenses');
  exp.columns = [
    { header: 'Date', width: 12 },
    { header: 'Category', width: 14 },
    { header: 'GBP', width: 10 },
    { header: 'USD', width: 10 },
    { header: 'Payment', width: 10 },
    { header: 'USD pending', width: 12 },
    { header: 'Entered in DTS', width: 14 },
    { header: 'Miles', width: 9 },
    { header: 'Rate', width: 9 },
    { header: 'Note', width: 28 },
  ];
  exp.getRow(1).font = { bold: true };
  for (const e of report.expenses) {
    const row = exp.addRow([
      e.date,
      e.category,
      e.amountGbp,
      e.amountUsd,
      e.payment,
      e.usdPending ? 'yes' : '',
      e.entered ? 'yes' : '',
      e.miles,
      e.rate,
      e.note,
    ]);
    row.getCell(3).numFmt = MONEY_FMT;
    row.getCell(4).numFmt = MONEY_FMT;
    row.getCell(8).numFmt = '0.0';
    row.getCell(9).numFmt = '0.000'; // DTS/GSA rates are sometimes 3dp
    if (e.usdPending) {
      for (let i = 1; i <= 10; i++) row.getCell(i).fill = pendingFill();
    }
  }

  // --- M&IE sheet: per-diem breakdown ---
  const mie = wb.addWorksheet('M&IE');
  mie.columns = [
    { header: 'Location', width: 18 },
    { header: 'Full rate', width: 11 },
    { header: 'Full days', width: 10 },
    { header: 'Partial rate', width: 12 },
    { header: 'Partial days', width: 12 },
    { header: 'Segment USD', width: 13 },
  ];
  mie.getRow(1).font = { bold: true };
  for (const s of report.segments) {
    const row = mie.addRow([
      s.location,
      s.fullRate,
      s.fullDays,
      s.partialRate,
      s.partialDays,
      s.usd,
    ]);
    for (const c of [2, 4, 6]) row.getCell(c).numFmt = MONEY_FMT;
  }
  const totalRow = mie.addRow(['', '', '', '', 'M&IE TOTAL', report.mieTotalUsd]);
  totalRow.font = { bold: true };
  totalRow.getCell(6).numFmt = MONEY_FMT;

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
