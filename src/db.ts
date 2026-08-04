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

// Receipt photo blobs get one key each, outside the expenses array, so editing
// an expense's fields never re-serializes photo bytes (and vice versa). Unlike
// the four fixed TripFields above there are a variable number of these per
// trip, so deletion needs a prefix scan (see deleteTripPhotos).
const photoPrefix = (tripId: string) => `trip:${tripId}:photo:`;
const photoKey = (tripId: string, photoId: string) =>
  `${photoPrefix(tripId)}${photoId}`;

const GLOBAL_KEYS = {
  trips: 'trips',
  activeTripId: 'activeTripId',
  lastBackup: 'lastBackup',
} as const;

// Snapshot of the device's data as of the last successful backup or
// restore, used by the backup nudge to compute days/edits since then.
// Absent (null) means "never backed up" — additive key, no migration.
export interface LastBackupInfo {
  at: string; // ISO timestamp
  expenseCount: number; // total expenses across all trips at that moment
}

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
// calculator's miles/rate (undefined -> null) and receipt photoIds
// (undefined -> []).
function normalizeExpenseRows(stored: Expense[]): Expense[] {
  return stored.map((e) => ({
    ...e,
    entered: e.entered ?? false,
    miles: e.miles ?? null,
    rate: e.rate ?? null,
    photoIds: e.photoIds ?? [],
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

// Defaults `total` for records stored before that field existed.
function normalizeDtsAccountExpected(
  stored: Partial<DtsAccountExpected> | null | undefined,
): DtsAccountExpected {
  return {
    gtcc: stored?.gtcc ?? null,
    personal: stored?.personal ?? null,
    total: stored?.total ?? null,
  };
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
  const stored = await store.getItem<Partial<DtsAccountExpected>>(
    tripKey(tripId, 'dtsAccountExpected'),
  );
  return normalizeDtsAccountExpected(stored);
}

export async function saveDtsAccountExpected(
  tripId: string,
  expected: DtsAccountExpected,
): Promise<void> {
  await store.setItem(tripKey(tripId, 'dtsAccountExpected'), expected);
}

// Photos are stored as raw bytes + MIME type rather than as a Blob directly.
// ArrayBuffer is a structured-clone primitive every IndexedDB implementation
// handles; Blob support is patchier (iOS Safari has a history of dropping
// them, which is why localforage ships its own workaround), and fake-indexeddb
// silently clones a Blob to `{}`, which would leave this path untestable.
// Callers still deal in Blobs — the conversion is contained here.
interface StoredPhoto {
  type: string;
  bytes: ArrayBuffer;
}

export async function savePhoto(
  tripId: string,
  photoId: string,
  blob: Blob,
): Promise<void> {
  const stored: StoredPhoto = {
    type: blob.type || 'image/jpeg',
    bytes: await blob.arrayBuffer(),
  };
  await store.setItem(photoKey(tripId, photoId), stored);
}

export async function loadPhoto(
  tripId: string,
  photoId: string,
): Promise<Blob | null> {
  const stored = await store.getItem<StoredPhoto>(photoKey(tripId, photoId));
  if (!stored) return null;
  return new Blob([stored.bytes], { type: stored.type });
}

export async function deletePhoto(
  tripId: string,
  photoId: string,
): Promise<void> {
  await store.removeItem(photoKey(tripId, photoId));
}

// Sweeps every photo blob belonging to a trip. Needs a key scan because the
// count varies per trip, unlike the four fixed per-trip keys.
async function deleteTripPhotos(tripId: string): Promise<void> {
  const prefix = photoPrefix(tripId);
  const keys = await store.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith(prefix)).map((k) => store.removeItem(k)),
  );
}

export async function deleteTripStorage(tripId: string): Promise<void> {
  await Promise.all([
    store.removeItem(tripKey(tripId, 'expenses')),
    store.removeItem(tripKey(tripId, 'segments')),
    store.removeItem(tripKey(tripId, 'dtsExpected')),
    store.removeItem(tripKey(tripId, 'dtsAccountExpected')),
    deleteTripPhotos(tripId),
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

export async function loadLastBackup(): Promise<LastBackupInfo | null> {
  return store.getItem<LastBackupInfo>(GLOBAL_KEYS.lastBackup);
}

export async function saveLastBackup(info: LastBackupInfo): Promise<void> {
  await store.setItem(GLOBAL_KEYS.lastBackup, info);
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

  const [expenses, segments, dtsExpectedRaw, dtsAccountExpectedRaw] =
    await Promise.all([
      store.getItem<Expense[]>(LEGACY_KEYS.expenses),
      store.getItem<MieSegment[]>(LEGACY_KEYS.segments),
      store.getItem<Record<string, unknown>>(LEGACY_KEYS.dtsExpected),
      store.getItem<Partial<DtsAccountExpected>>(LEGACY_KEYS.dtsAccountExpected),
    ]);

  await Promise.all([
    saveExpenses(id, normalizeExpenseRows(expenses ?? [])),
    saveSegments(id, segments ?? []),
    saveDtsExpected(id, normalizeDtsExpected(dtsExpectedRaw ?? {})),
    saveDtsAccountExpected(id, normalizeDtsAccountExpected(dtsAccountExpectedRaw)),
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
