import { describe, it, expect, beforeEach } from 'vitest';
import {
  __clearForTests,
  deleteTripStorage,
  ensureInitialized,
  loadActiveTripId,
  loadDtsAccountExpected,
  loadDtsExpected,
  loadExpenses,
  loadSegments,
  loadTrips,
  saveActiveTripId,
  saveAllTripsData,
  saveDtsAccountExpected,
  saveDtsExpected,
  saveExpenses,
  saveSegments,
  saveTrips,
} from './db';
import type { Expense, TripBackup } from './types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: null,
  amount_usd: 10,
  payment: 'GTCC',
  note: '',
  entered: false,
  miles: null,
  rate: null,
  ...over,
});

beforeEach(async () => {
  await __clearForTests();
});

describe('ensureInitialized', () => {
  it('creates one empty synthetic trip on a fresh install', async () => {
    const { trips, activeTripId } = await ensureInitialized();
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe(activeTripId);
    expect(await loadExpenses(activeTripId)).toEqual([]);
  });

  it('migrates legacy flat-key data into a synthetic first trip', async () => {
    // Simulate a pre-multi-trip user by writing directly under the old flat
    // keys, the same shape loadExpenses/etc. used to read before this feature.
    const legacyStore = (
      await import('localforage')
    ).default.createInstance({ name: 'dts-expense-tracker', storeName: 'trip' });
    await legacyStore.setItem('expenses', [exp({ note: 'legacy row' })]);
    await legacyStore.setItem('segments', [
      { id: 's', location: 'London', full_rate: 100, partial_rate: 75, full_days: 1, partial_days: 0 },
    ]);
    await legacyStore.setItem('dtsExpected', { LODGING: 10 });
    await legacyStore.setItem('dtsAccountExpected', { gtcc: 10, personal: null });

    const { trips, activeTripId } = await ensureInitialized();
    expect(trips).toHaveLength(1);

    const expenses = await loadExpenses(activeTripId);
    expect(expenses).toHaveLength(1);
    expect(expenses[0].note).toBe('legacy row');
    expect(await loadSegments(activeTripId)).toHaveLength(1);
    expect(await loadDtsExpected(activeTripId)).toEqual({ LODGING: 10 });
    expect(await loadDtsAccountExpected(activeTripId)).toEqual({
      gtcc: 10,
      personal: null,
      total: null, // legacy record predates this field; defaults to null
    });
  });

  it('is idempotent — a second call returns the same trip, does not re-migrate', async () => {
    const first = await ensureInitialized();
    const second = await ensureInitialized();
    expect(second.trips).toEqual(first.trips);
    expect(second.activeTripId).toBe(first.activeTripId);
  });

  it('falls back to the first trip when no activeTripId was ever saved', async () => {
    await saveTrips([
      { id: 'a', name: 'A', createdAt: '2026-01-01' },
      { id: 'b', name: 'B', createdAt: '2026-01-02' },
    ]);
    expect(await loadActiveTripId()).toBeNull();

    const { activeTripId } = await ensureInitialized();
    expect(activeTripId).toBe('a');
  });

  it('honors a previously saved activeTripId across multiple trips', async () => {
    await saveTrips([
      { id: 'a', name: 'A', createdAt: '2026-01-01' },
      { id: 'b', name: 'B', createdAt: '2026-01-02' },
    ]);
    await saveActiveTripId('b');

    const { activeTripId } = await ensureInitialized();
    expect(activeTripId).toBe('b');
  });
});

describe('per-trip data scoping', () => {
  it('round-trips expenses/segments/DTS totals for a given trip id', async () => {
    await saveExpenses('t1', [exp()]);
    await saveSegments('t1', [
      { id: 's', location: 'X', full_rate: 1, partial_rate: 1, full_days: 1, partial_days: 0 },
    ]);
    await saveDtsExpected('t1', { LODGING: 5 });
    await saveDtsAccountExpected('t1', { gtcc: 5, personal: null, total: null });

    expect(await loadExpenses('t1')).toHaveLength(1);
    expect(await loadSegments('t1')).toHaveLength(1);
    expect(await loadDtsExpected('t1')).toEqual({ LODGING: 5 });
    expect(await loadDtsAccountExpected('t1')).toEqual({
      gtcc: 5,
      personal: null,
      total: null,
    });
  });

  it('does not leak data between two different trip ids', async () => {
    await saveExpenses('t1', [exp({ note: 'trip one' })]);
    await saveExpenses('t2', [exp({ note: 'trip two' })]);

    expect((await loadExpenses('t1'))[0].note).toBe('trip one');
    expect((await loadExpenses('t2'))[0].note).toBe('trip two');
  });

  it('deleteTripStorage removes only the target trip\'s keys', async () => {
    await saveExpenses('t1', [exp()]);
    await saveExpenses('t2', [exp()]);

    await deleteTripStorage('t1');

    expect(await loadExpenses('t1')).toEqual([]);
    expect(await loadExpenses('t2')).toHaveLength(1);
  });

  it('saveAllTripsData bulk-writes multiple trips correctly', async () => {
    const backups: TripBackup[] = [
      {
        id: 't1',
        name: 'Trip One',
        createdAt: '2026-01-01',
        expenses: [exp({ note: 'one' })],
        segments: [],
        dtsExpected: {},
        dtsAccountExpected: { gtcc: null, personal: null, total: null },
      },
      {
        id: 't2',
        name: 'Trip Two',
        createdAt: '2026-01-02',
        expenses: [exp({ note: 'two' })],
        segments: [],
        dtsExpected: {},
        dtsAccountExpected: { gtcc: null, personal: null, total: null },
      },
    ];

    await saveAllTripsData(backups);

    expect((await loadExpenses('t1'))[0].note).toBe('one');
    expect((await loadExpenses('t2'))[0].note).toBe('two');
  });
});

describe('trip list persistence', () => {
  it('round-trips the trip list', async () => {
    const trips = [{ id: 'a', name: 'A', createdAt: '2026-01-01' }];
    await saveTrips(trips);
    expect(await loadTrips()).toEqual(trips);
  });

  it('returns null when never initialized', async () => {
    expect(await loadTrips()).toBeNull();
  });
});
