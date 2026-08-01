// Fixed category set, in fixed order (see SPEC.md § Categories).
export const CATEGORIES = [
  'COM CARRIER',
  'GTCC (FEES)',
  'LODGING',
  'M&IE',
  'MILEAGE',
  'RENTAL CAR',
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
  // Mileage calculator inputs (MILEAGE only): amount_usd is derived from
  // miles * rate at entry/edit time but stays independently editable
  // afterward. Null for every other category.
  miles: number | null;
  rate: number | null; // USD per mile
}

// DTS reports USD only, so reconciliation is USD-only throughout.
// Per-category total the user reads off DTS (absent/null = not checked yet).
export type DtsExpected = Partial<Record<Category, number | null>>;

// Account buckets used for the split-reimbursement reconciliation.
export type Account = 'gtcc' | 'personal';

// Reimbursement totals DTS shows per account (USD), plus the all-expenses
// grand total (GTCC + Personal) shown above the split — independent of the
// split itself, so it isn't keyed by Account.
export interface DtsAccountExpected {
  gtcc: number | null;
  personal: number | null;
  total: number | null;
}

// One trip's identity. Its data (expenses/segments/DTS totals) lives under
// trip-scoped keys in db.ts, not on this record.
export interface Trip {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
}

// A trip's identity plus its full data — the unit both whole-device backup
// (lib/backup.ts) and bulk restore (db.ts) operate on.
export interface TripBackup extends Trip {
  expenses: Expense[];
  segments: MieSegment[];
  dtsExpected: DtsExpected;
  dtsAccountExpected: DtsAccountExpected;
}

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
