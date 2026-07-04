import type { Expense, MieSegment } from '../types';
import { isUsdPending } from '../types';
import { segmentTotal, mieTotalUsd } from './mie';
import { totalsByCategory, totalsByAccount } from './totals';

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

// One file: raw rows first, then a totals block. Both venues (emailed sheet at
// the office, app at home) read from the same shape.
export function buildCsv(expenses: Expense[], segments: MieSegment[]): string {
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
      'note',
    ]),
  );
  for (const e of expenses) {
    lines.push(
      row([
        e.date,
        e.category,
        num(e.amount_gbp),
        num(e.amount_usd),
        e.payment,
        isUsdPending(e) ? 'yes' : '',
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
  for (const s of segments) {
    lines.push(
      row([
        s.location,
        num(s.full_rate),
        s.full_days,
        num(s.partial_rate),
        s.partial_days,
        num(segmentTotal(s)),
      ]),
    );
  }
  lines.push(row(['', '', '', '', 'M&IE TOTAL', num(mieTotalUsd(segments))]));

  lines.push('');
  lines.push('TOTALS BY CATEGORY');
  lines.push(row(['category', 'gbp', 'usd']));
  for (const r of totalsByCategory(expenses, segments)) {
    lines.push(row([r.category, num(r.gbp), num(r.usd)]));
  }

  lines.push('');
  lines.push('TOTALS BY ACCOUNT');
  lines.push(row(['account', 'gbp', 'usd']));
  const acct = totalsByAccount(expenses, segments);
  lines.push(row(['GTCC', num(acct.gtcc.gbp), num(acct.gtcc.usd)]));
  lines.push(row(['Personal', num(acct.personal.gbp), num(acct.personal.usd)]));

  return lines.join('\r\n');
}

export function csvFilename(now = new Date()): string {
  return `dts-expenses-${now.toISOString().slice(0, 10)}.csv`;
}
