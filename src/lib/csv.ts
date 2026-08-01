import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { buildReport } from './report';
import type { MatchStatus } from './reconcile';
import { slugify } from './format';

// Hand-rolled CSV (no dependency, per SPEC.md). Excel/Sheets-safe escaping.
function cell(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: (string | number | null)[]): string {
  return cells.map(cell).join(',');
}

// Money for the spreadsheet: plain number (2dp) or blank, never a currency glyph
// or an em dash — the office workstation reconciles against DTS numerically.
function num(amount: number | null): string {
  return amount == null ? '' : amount.toFixed(2);
}

// Miles/rate audit columns (MILEAGE only): raw value, unrounded, or blank —
// unlike num() these aren't money-formatted to 2dp, since DTS/GSA rates are
// sometimes 3dp (e.g. $0.655/mile) and rounding would misrepresent what was
// actually entered.
function raw(value: number | null): string {
  return value == null ? '' : String(value);
}

// Greppable reconciliation status for the office spreadsheet.
function status(s: MatchStatus): string {
  return s === 'mismatch' ? 'MISMATCH' : s === 'match' ? 'ok' : '';
}

// One file: raw rows first, then a totals block (with the DTS comparison, since
// the emailed sheet is the office's reconciliation view). Both venues — the
// sheet at the office, the app at home — read from the same shape.
export function buildCsv(
  expenses: Expense[],
  segments: MieSegment[],
  expected: DtsExpected = {},
  accountExpected: DtsAccountExpected = { gtcc: null, personal: null, total: null },
): string {
  const report = buildReport(expenses, segments, expected, accountExpected);
  const lines: string[] = [];

  lines.push('EXPENSES');
  lines.push(
    row([
      'date',
      'category',
      'amount_gbp',
      'amount_usd',
      'payment',
      'usd_pending',
      'entered_in_dts',
      'miles',
      'rate',
      'note',
    ]),
  );
  for (const e of report.expenses) {
    lines.push(
      row([
        e.date,
        e.category,
        num(e.amountGbp),
        num(e.amountUsd),
        e.payment,
        e.usdPending ? 'yes' : '',
        e.entered ? 'yes' : '',
        raw(e.miles),
        raw(e.rate),
        e.note,
      ]),
    );
  }

  lines.push('');
  lines.push('M&IE SEGMENTS (USD, Personal)');
  lines.push(
    row([
      'location',
      'full_rate',
      'full_days',
      'partial_rate',
      'partial_days',
      'segment_usd',
    ]),
  );
  for (const s of report.segments) {
    lines.push(
      row([
        s.location,
        num(s.fullRate),
        s.fullDays,
        num(s.partialRate),
        s.partialDays,
        num(s.usd),
      ]),
    );
  }
  lines.push(row(['', '', '', '', 'M&IE TOTAL', num(report.mieTotalUsd)]));

  // DTS reconciliation is USD-only, so the dts/delta/status columns are USD.
  // usd_incomplete flags a row fed by a USD-pending expense: the comparison
  // above is premature, regardless of what status says.
  lines.push('');
  lines.push('TOTALS BY CATEGORY');
  lines.push(
    row(['category', 'gbp', 'usd', 'dts_usd', 'delta_usd', 'status', 'usd_incomplete']),
  );
  for (const r of report.categories) {
    lines.push(
      row([
        r.category,
        num(r.gbp),
        num(r.usd),
        num(r.recon.dts),
        num(r.recon.delta),
        status(r.recon.status),
        r.usdPendingCount > 0 ? 'yes' : '',
      ]),
    );
  }

  lines.push('');
  lines.push('TOTALS BY ACCOUNT');
  lines.push(
    row(['account', 'gbp', 'usd', 'dts_usd', 'delta_usd', 'status', 'usd_incomplete']),
  );
  for (const a of report.accounts) {
    lines.push(
      row([
        a.label,
        num(a.gbp),
        num(a.usd),
        num(a.recon.dts),
        num(a.recon.delta),
        status(a.recon.status),
        a.usdPendingCount > 0 ? 'yes' : '',
      ]),
    );
  }

  return lines.join('\r\n');
}

export function csvFilename(tripName: string, now = new Date()): string {
  return `dts-expenses-${slugify(tripName)}-${now.toISOString().slice(0, 10)}.csv`;
}
