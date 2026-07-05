import type {
  Account,
  Category,
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
  Payment,
} from '../types';
import { isEntered, isUsdPending } from '../types';
import { mieTotalUsd, segmentTotal } from './mie';
import {
  totalsByCategory,
  totalsByAccount,
  usdPendingCountsByCategory,
  usdPendingCountsByAccount,
} from './totals';
import { reconcileCategories, reconcileAccounts, type Reconcile } from './reconcile';

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

export interface Report {
  expenses: ReportExpenseRow[];
  segments: ReportSegmentRow[];
  mieTotalUsd: number;
  categories: ReportCategoryRow[];
  accounts: ReportAccountRow[];
}

export function buildReport(
  expenses: Expense[],
  segments: MieSegment[],
  expected: DtsExpected = {},
  accountExpected: DtsAccountExpected = { gtcc: null, personal: null },
): Report {
  const byCategory = totalsByCategory(expenses, segments);
  const catRecon = new Map(
    reconcileCategories(byCategory, expected).map((r) => [r.category, r.usd]),
  );
  const catPending = usdPendingCountsByCategory(expenses);
  const byAccount = totalsByAccount(expenses, segments);
  const acctRecon = reconcileAccounts(byAccount, accountExpected);
  const acctPending = usdPendingCountsByAccount(expenses);

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
  };
}
