import type {
  Account,
  Category,
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
  Payment,
} from '../types';
import { hasPhoto, isEntered, isUsdPending } from '../types';
import { mieTotalUsd, segmentTotal } from './mie';
import {
  totalsByCategory,
  totalsByAccount,
  usdPendingCountsByCategory,
  usdPendingCountsByAccount,
} from './totals';
import {
  reconcileCategories,
  reconcileAccounts,
  reconcileAccountTotal,
  type Reconcile,
} from './reconcile';

// A single structured model of an export, so the CSV and XLSX exporters render
// from the same numbers and never drift.

export interface ReportExpenseRow {
  date: string;
  category: Category;
  amountGbp: number | null;
  amountUsd: number | null;
  payment: Payment;
  usdPending: boolean;
  entered: boolean;
  note: string;
  miles: number | null; // MILEAGE calculator inputs; null for every other category
  rate: number | null;
  // 1-based index into the receipts .zip, sequential across rows that have a
  // photo; null when the row has none. Recomputed on every export rather than
  // persisted — the zip always ships the spreadsheet and the images together,
  // so a bundle is internally consistent even if the numbering shifts between
  // exports.
  receiptNo: number | null;
}

export interface ReportSegmentRow {
  location: string;
  fullRate: number;
  fullDays: number;
  partialRate: number;
  partialDays: number;
  usd: number;
}

export interface ReportCategoryRow {
  category: Category;
  gbp: number;
  usd: number;
  usdPendingCount: number; // # expenses missing USD feeding this row; >0 = incomplete
  recon: Reconcile; // USD reconciliation vs DTS
}

export interface ReportAccountRow {
  account: Account;
  label: string; // 'GTCC' | 'Personal'
  gbp: number;
  usd: number;
  usdPendingCount: number; // # expenses missing USD feeding this row; >0 = incomplete
  recon: Reconcile;
}

// The all-expenses grand total (GTCC + Personal), reconciled independently of
// the split above. Not keyed by Account — see DtsAccountExpected.total.
export interface ReportTotalRow {
  label: string; // 'Total'
  gbp: number;
  usd: number;
  usdPendingCount: number;
  recon: Reconcile;
}

export interface Report {
  expenses: ReportExpenseRow[];
  segments: ReportSegmentRow[];
  mieTotalUsd: number;
  categories: ReportCategoryRow[];
  accounts: ReportAccountRow[];
  accountTotal: ReportTotalRow;
}

export function buildReport(
  expenses: Expense[],
  segments: MieSegment[],
  expected: DtsExpected = {},
  accountExpected: DtsAccountExpected = { gtcc: null, personal: null, total: null },
): Report {
  const byCategory = totalsByCategory(expenses, segments);
  const catRecon = new Map(
    reconcileCategories(byCategory, expected).map((r) => [r.category, r.usd]),
  );
  const catPending = usdPendingCountsByCategory(expenses);
  const byAccount = totalsByAccount(expenses, segments);
  const acctRecon = reconcileAccounts(byAccount, accountExpected);
  const acctTotalRecon = reconcileAccountTotal(byAccount, accountExpected);
  const acctPending = usdPendingCountsByAccount(expenses);

  // Numbering follows the expense order the exporters already render, so the
  // receipt numbers run straight down the sheet being keyed into DTS.
  let nextReceiptNo = 1;

  return {
    expenses: expenses.map((e) => ({
      date: e.date,
      category: e.category,
      amountGbp: e.amount_gbp,
      amountUsd: e.amount_usd,
      payment: e.payment,
      usdPending: isUsdPending(e),
      entered: isEntered(e),
      note: e.note,
      miles: e.miles,
      rate: e.rate,
      receiptNo: hasPhoto(e) ? nextReceiptNo++ : null,
    })),
    segments: segments.map((s) => ({
      location: s.location,
      fullRate: s.full_rate,
      fullDays: s.full_days,
      partialRate: s.partial_rate,
      partialDays: s.partial_days,
      usd: segmentTotal(s),
    })),
    mieTotalUsd: mieTotalUsd(segments),
    categories: byCategory.map((r) => ({
      category: r.category,
      gbp: r.gbp,
      usd: r.usd,
      usdPendingCount: catPending.get(r.category) ?? 0,
      recon: catRecon.get(r.category)!,
    })),
    accounts: [
      {
        account: 'gtcc',
        label: 'GTCC',
        gbp: byAccount.gtcc.gbp,
        usd: byAccount.gtcc.usd,
        usdPendingCount: acctPending.gtcc,
        recon: acctRecon[0].usd,
      },
      {
        account: 'personal',
        label: 'Personal',
        gbp: byAccount.personal.gbp,
        usd: byAccount.personal.usd,
        usdPendingCount: acctPending.personal,
        recon: acctRecon[1].usd,
      },
    ],
    accountTotal: {
      label: 'Total',
      gbp: byAccount.gtcc.gbp + byAccount.personal.gbp,
      usd: byAccount.gtcc.usd + byAccount.personal.usd,
      usdPendingCount: acctPending.gtcc + acctPending.personal,
      recon: acctTotalRecon,
    },
  };
}
