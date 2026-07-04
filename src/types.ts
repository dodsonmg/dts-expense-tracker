// Fixed category set, in fixed order (see SPEC.md § Categories).
export const CATEGORIES = [
  'COM CARRIER',
  'GTCC (FEES)',
  'LODGING',
  'M&IE',
  'MILEAGE',
  'TRANSPORT',
  'OTHER',
] as const;

export type Category = (typeof CATEGORIES)[number];

// M&IE is computed from the per-diem calculator, not entered as an itemized row.
export type ItemizedCategory = Exclude<Category, 'M&IE'>;

export const ITEMIZED_CATEGORIES = CATEGORIES.filter(
  (c): c is ItemizedCategory => c !== 'M&IE',
);

export type Payment = 'GTCC' | 'personal';
export type Currency = 'GBP' | 'USD';

// An itemized expense. Applies to every category except M&IE.
export interface Expense {
  id: string;
  date: string; // ISO YYYY-MM-DD
  category: ItemizedCategory;
  amount_gbp: number | null; // matches the receipt, entered at purchase
  amount_usd: number | null; // backfilled when it hits the card / typed into DTS
  payment: Payment;
  note: string;
  entered: boolean; // reconciliation: has this been keyed into DTS yet?
}

// Totals the user reads off DTS, to reconcile against the app's computed
// category totals. Per category, per currency; null = not checked yet. GBP and
// USD are compared independently and never summed.
export interface DtsCategoryExpected {
  gbp: number | null;
  usd: number | null;
}

// Only categories the user has entered a DTS figure for are present.
export type DtsExpected = Partial<Record<Category, DtsCategoryExpected>>;

// A single location segment of the M&IE per-diem calculation. USD only.
export interface MieSegment {
  id: string;
  location: string; // label only; not part of the math
  full_rate: number;
  partial_rate: number;
  full_days: number;
  partial_days: number;
}

// An expense with a GBP amount but no USD amount is "USD pending":
// still outstanding on the card statement.
export function isUsdPending(e: Expense): boolean {
  return e.amount_gbp != null && e.amount_usd == null;
}

// Whether an expense has been entered into DTS. Defensive against legacy rows
// persisted before this field existed (undefined -> not entered / outstanding).
export function isEntered(e: Expense): boolean {
  return e.entered === true;
}
