import localforage from 'localforage';
import { newId } from './lib/id';
import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
  Trip,
  TripBackup,
} from './types';

// Single offline store, IndexedDB-backed. Nothing leaves the device except the
// CSV the user chooses to email (SPEC.md § No backend).
const store = localforage.createInstance({
  name: 'dts-expense-tracker',
  storeName: 'trip',
  description: 'Local trip expenses + M&IE segments',
});

// Trip-scoped data lives under `trip:<id>:<field>` keys in this same store —
// simpler than one localforage instance per trip (which would create a new
// IndexedDB object store per trip with no registry to enumerate them).
type TripField = 'expenses' | 'segments' | 'dtsExpected' | 'dtsAccountExpected';
const tripKey = (tripId: string, field: TripField) => `trip:${tripId}:${field}`;

const GLOBAL_KEYS = {
  trips: 'trips',
  activeTripId: 'activeTripId',
} as const;

// Pre-multi-trip flat keys. Read only once, by ensureInitialized, to migrate
// an existing single-trip user's data into a synthetic first trip. Never
// deleted afterward (cheap safety net) and never read again once `trips`
// exists.
const LEGACY_KEYS = {
  expenses: 'expenses',
  segments: 'segments',
  dtsExpected: 'dtsExpected',
  dtsAccountExpected: 'dtsAccountExpected',
} as const;

// Normalize rows saved before a field was added: default `entered` for legacy
// rows persisted without it (undefined -> false), same for the mileage
// calculator's miles/rate (undefined -> null).
function normalizeExpenseRows(stored: Expense[]): Expense[] {
  return stored.map((e) => ({
    ...e,
    entered: e.entered ?? false,
    miles: e.miles ?? null,
    rate: e.rate ?? null,
  }));
}

// Normalize any earlier {gbp, usd} shape down to the USD-only number model.
function normalizeDtsExpected(stored: Record<string, unknown>): DtsExpected {
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

export async function loadExpenses(tripId: string): Promise<Expense[]> {
  const stored =
    (await store.getItem<Expense[]>(tripKey(tripId, 'expenses'))) ?? [];
  return normalizeExpenseRows(stored);
}

export async function saveExpenses(
  tripId: string,
  expenses: Expense[],
): Promise<void> {
  await store.setItem(tripKey(tripId, 'expenses'), expenses);
}

export async function loadSegments(tripId: string): Promise<MieSegment[]> {
  return (await store.getItem<MieSegment[]>(tripKey(tripId, 'segments'))) ?? [];
}

export async function saveSegments(
  tripId: string,
  segments: MieSegment[],
): Promise<void> {
  await store.setItem(tripKey(tripId, 'segments'), segments);
}

export async function loadDtsExpected(tripId: string): Promise<DtsExpected> {
  const stored =
    (await store.getItem<Record<string, unknown>>(
      tripKey(tripId, 'dtsExpected'),
    )) ?? {};
  return normalizeDtsExpected(stored);
}

export async function saveDtsExpected(
  tripId: string,
  expected: DtsExpected,
): Promise<void> {
  await store.setItem(tripKey(tripId, 'dtsExpected'), expected);
}

export async function loadDtsAccountExpected(
  tripId: string,
): Promise<DtsAccountExpected> {
  return (
    (await store.getItem<DtsAccountExpected>(
      tripKey(tripId, 'dtsAccountExpected'),
    )) ?? { gtcc: null, personal: null }
  );
}

export async function saveDtsAccountExpected(
  tripId: string,
  expected: DtsAccountExpected,
): Promise<void> {
  await store.setItem(tripKey(tripId, 'dtsAccountExpected'), expected);
}

export async function deleteTripStorage(tripId: string): Promise<void> {
  await Promise.all([
    store.removeItem(tripKey(tripId, 'expenses')),
    store.removeItem(tripKey(tripId, 'segments')),
    store.removeItem(tripKey(tripId, 'dtsExpected')),
    store.removeItem(tripKey(tripId, 'dtsAccountExpected')),
  ]);
}

// Bulk writer for whole-device backup restore (issue #7 v2) — writes every
// trip's data directly to storage; the caller (useTrips.restoreFromBackup)
// separately replaces the `trips` list/active id.
export async function saveAllTripsData(trips: TripBackup[]): Promise<void> {
  await Promise.all(
    trips.flatMap((t) => [
      saveExpenses(t.id, t.expenses),
      saveSegments(t.id, t.segments),
      saveDtsExpected(t.id, t.dtsExpected),
      saveDtsAccountExpected(t.id, t.dtsAccountExpected),
    ]),
  );
}

export async function loadTrips(): Promise<Trip[] | null> {
  return store.getItem<Trip[]>(GLOBAL_KEYS.trips);
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await store.setItem(GLOBAL_KEYS.trips, trips);
}

export async function loadActiveTripId(): Promise<string | null> {
  return store.getItem<string>(GLOBAL_KEYS.activeTripId);
}

export async function saveActiveTripId(id: string): Promise<void> {
  await store.setItem(GLOBAL_KEYS.activeTripId, id);
}

// Runs once, on first load after multi-trip shipped. If `trips` already
// exists, no-ops (besides resolving the active id). Otherwise builds exactly
// one synthetic trip from whatever the legacy flat keys contain — empty
// arrays for a genuinely fresh install, real data for an upgrading user.
export async function ensureInitialized(): Promise<{
  trips: Trip[];
  activeTripId: string;
}> {
  const existing = await loadTrips();
  if (existing && existing.length > 0) {
    const activeTripId = (await loadActiveTripId()) ?? existing[0].id;
    return { trips: existing, activeTripId };
  }

  const id = newId();
  const trip: Trip = {
    id,
    name: 'Trip 1',
    createdAt: new Date().toISOString(),
  };

  const [expenses, segments, dtsExpectedRaw, dtsAccountExpected] =
    await Promise.all([
      store.getItem<Expense[]>(LEGACY_KEYS.expenses),
      store.getItem<MieSegment[]>(LEGACY_KEYS.segments),
      store.getItem<Record<string, unknown>>(LEGACY_KEYS.dtsExpected),
      store.getItem<DtsAccountExpected>(LEGACY_KEYS.dtsAccountExpected),
    ]);

  await Promise.all([
    saveExpenses(id, normalizeExpenseRows(expenses ?? [])),
    saveSegments(id, segments ?? []),
    saveDtsExpected(id, normalizeDtsExpected(dtsExpectedRaw ?? {})),
    saveDtsAccountExpected(id, dtsAccountExpected ?? { gtcc: null, personal: null }),
    saveTrips([trip]),
    saveActiveTripId(id),
  ]);

  return { trips: [trip], activeTripId: id };
}

// Test-only: wipes every key in this instance's store so each test starts
// from a clean slate. Not used by app code.
export async function __clearForTests(): Promise<void> {
  await store.clear();
}
