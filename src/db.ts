import localforage from 'localforage';
import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from './types';

// Single offline store, IndexedDB-backed. Nothing leaves the device except the
// CSV the user chooses to email (SPEC.md § No backend).
const store = localforage.createInstance({
  name: 'dts-expense-tracker',
  storeName: 'trip',
  description: 'Local trip expenses + M&IE segments',
});

const KEYS = {
  expenses: 'expenses',
  segments: 'segments',
  dtsExpected: 'dtsExpected',
  dtsAccountExpected: 'dtsAccountExpected',
} as const;

export async function loadExpenses(): Promise<Expense[]> {
  const stored = (await store.getItem<Expense[]>(KEYS.expenses)) ?? [];
  // Normalize rows saved before a field was added: default `entered` for
  // legacy rows persisted without it (undefined -> false), same for the
  // mileage calculator's miles/rate (undefined -> null).
  return stored.map((e) => ({
    ...e,
    entered: e.entered ?? false,
    miles: e.miles ?? null,
    rate: e.rate ?? null,
  }));
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await store.setItem(KEYS.expenses, expenses);
}

export async function loadSegments(): Promise<MieSegment[]> {
  return (await store.getItem<MieSegment[]>(KEYS.segments)) ?? [];
}

export async function saveSegments(segments: MieSegment[]): Promise<void> {
  await store.setItem(KEYS.segments, segments);
}

export async function loadDtsExpected(): Promise<DtsExpected> {
  const stored = (await store.getItem<Record<string, unknown>>(
    KEYS.dtsExpected,
  )) ?? {};
  // Normalize any earlier {gbp, usd} shape down to the USD-only number model.
  const out: DtsExpected = {};
  for (const [cat, val] of Object.entries(stored)) {
    const usd =
      val != null && typeof val === 'object'
        ? ((val as { usd?: number | null }).usd ?? null)
        : (val as number | null);
    out[cat as keyof DtsExpected] = usd;
  }
  return out;
}

export async function saveDtsExpected(expected: DtsExpected): Promise<void> {
  await store.setItem(KEYS.dtsExpected, expected);
}

export async function loadDtsAccountExpected(): Promise<DtsAccountExpected> {
  return (
    (await store.getItem<DtsAccountExpected>(KEYS.dtsAccountExpected)) ?? {
      gtcc: null,
      personal: null,
    }
  );
}

export async function saveDtsAccountExpected(
  expected: DtsAccountExpected,
): Promise<void> {
  await store.setItem(KEYS.dtsAccountExpected, expected);
}
