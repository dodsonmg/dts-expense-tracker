import localforage from 'localforage';
import type { Expense, MieSegment } from './types';

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
} as const;

export async function loadExpenses(): Promise<Expense[]> {
  const stored = (await store.getItem<Expense[]>(KEYS.expenses)) ?? [];
  // Normalize rows saved before a field was added: default `entered` for
  // legacy rows persisted without it (undefined -> false).
  return stored.map((e) => ({ ...e, entered: e.entered ?? false }));
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
