import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTrips } from './useTrips';
import { __clearForTests, loadExpenses } from './db';
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

describe('useTrips', () => {
  it('auto-creates one trip on first load', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.activeTripId).toBe(result.current.trips[0].id);
  });

  it('creates a trip and switches to it', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let newId = '';
    act(() => {
      newId = result.current.createTrip('Ramstein Sep 2026');
    });

    await waitFor(() => expect(result.current.trips).toHaveLength(2));
    expect(result.current.activeTripId).toBe(newId);
    expect(result.current.trips.find((t) => t.id === newId)?.name).toBe(
      'Ramstein Sep 2026',
    );
  });

  it('renames a trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const id = result.current.trips[0].id;

    act(() => result.current.renameTrip(id, 'London Aug 2026'));

    await waitFor(() =>
      expect(result.current.trips.find((t) => t.id === id)?.name).toBe(
        'London Aug 2026',
      ),
    );
  });

  it('refuses to delete the last remaining trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const id = result.current.trips[0].id;

    act(() => result.current.deleteTrip(id));

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].id).toBe(id);
  });

  it('deleting the active trip reassigns activeTripId to a remaining trip', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const firstId = result.current.trips[0].id;

    let secondId = '';
    act(() => {
      secondId = result.current.createTrip('Second trip');
    });
    await waitFor(() => expect(result.current.trips).toHaveLength(2));
    expect(result.current.activeTripId).toBe(secondId);

    act(() => result.current.deleteTrip(secondId));

    await waitFor(() => expect(result.current.trips).toHaveLength(1));
    expect(result.current.activeTripId).toBe(firstId);
  });

  it('restoreFromBackup replaces the trip list and writes every trip\'s data', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const initialEpoch = result.current.reloadEpoch;

    const backupTrips: TripBackup[] = [
      {
        id: 'r1',
        name: 'Restored One',
        createdAt: '2026-01-01',
        expenses: [exp({ note: 'restored one' })],
        segments: [],
        dtsExpected: {},
        dtsAccountExpected: { gtcc: null, personal: null, total: null },
      },
      {
        id: 'r2',
        name: 'Restored Two',
        createdAt: '2026-01-02',
        expenses: [exp({ note: 'restored two' })],
        segments: [],
        dtsExpected: {},
        dtsAccountExpected: { gtcc: null, personal: null, total: null },
      },
    ];

    await act(async () => {
      await result.current.restoreFromBackup({
        version: 2,
        exportedAt: '2026-01-01',
        trips: backupTrips,
      });
    });

    expect(result.current.trips.map((t) => t.id)).toEqual(['r1', 'r2']);
    expect(result.current.activeTripId).toBe('r1');
    expect(result.current.reloadEpoch).toBeGreaterThan(initialEpoch);
    expect((await loadExpenses('r1'))[0].note).toBe('restored one');
    expect((await loadExpenses('r2'))[0].note).toBe('restored two');
  });

  it('loadAllTripsData reads every trip\'s data from storage', async () => {
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let secondId = '';
    act(() => {
      secondId = result.current.createTrip('Second trip');
    });
    await waitFor(() => expect(result.current.trips).toHaveLength(2));

    const all = await result.current.loadAllTripsData();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.id).sort()).toEqual(
      [result.current.trips[0].id, secondId].sort(),
    );
  });
});
