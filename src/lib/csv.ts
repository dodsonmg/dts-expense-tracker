import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { isEntered, isUsdPending } from '../types';
import { segmentTotal, mieTotalUsd } from './mie';
import { totalsByCategory, totalsByAccount } from './totals';
import {
  reconcileCategories,
  reconcileAccounts,
  type MatchStatus,
} from './reconcile';

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
  accountExpected: DtsAccountExpected = { gtcc: null, personal: null },
): string {
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
        isEntered(e) ? 'yes' : '',
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

  // DTS reconciliation is USD-only, so the dts/delta/status columns are USD.
  const byCategory = totalsByCategory(expenses, segments);
  const catRecon = new Map(
    reconcileCategories(byCategory, expected).map((r) => [r.category, r.usd]),
  );

  lines.push('');
  lines.push('TOTALS BY CATEGORY');
  lines.push(row(['category', 'gbp', 'usd', 'dts_usd', 'delta_usd', 'status']));
  for (const r of byCategory) {
    const rec = catRecon.get(r.category)!;
    lines.push(
      row([
        r.category,
        num(r.gbp),
        num(r.usd),
        num(rec.dts),
        num(rec.delta),
        status(rec.status),
      ]),
    );
  }

  const acct = totalsByAccount(expenses, segments);
  const acctRecon = reconcileAccounts(acct, accountExpected);
  const gtcc = acctRecon[0].usd;
  const personal = acctRecon[1].usd;

  lines.push('');
  lines.push('TOTALS BY ACCOUNT');
  lines.push(row(['account', 'gbp', 'usd', 'dts_usd', 'delta_usd', 'status']));
  lines.push(
    row([
      'GTCC',
      num(acct.gtcc.gbp),
      num(acct.gtcc.usd),
      num(gtcc.dts),
      num(gtcc.delta),
      status(gtcc.status),
    ]),
  );
  lines.push(
    row([
      'Personal',
      num(acct.personal.gbp),
      num(acct.personal.usd),
      num(personal.dts),
      num(personal.delta),
      status(personal.status),
    ]),
  );

  return lines.join('\r\n');
}

export function csvFilename(now = new Date()): string {
  return `dts-expenses-${now.toISOString().slice(0, 10)}.csv`;
}
