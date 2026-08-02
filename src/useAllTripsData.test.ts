import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAllTripsData } from './useAllTripsData';
import type { Expense, Trip } from './types';

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

const expensesByTrip: Record<string, Expense[]> = {
  t1: [exp({ id: 'a', note: 'trip one' })],
  t2: [exp({ id: 'b', note: 'trip two' })],
};

const loadExpenses = vi.fn((tripId: string) => Promise.resolve(expensesByTrip[tripId] ?? []));

// db.ts talks to IndexedDB, which jsdom doesn't implement — mock it so the
// hook's own load/keying logic can be tested in isolation.
vi.mock('./db', () => ({
  loadExpenses: (tripId: string) => loadExpenses(tripId),
}));

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Trip',
  createdAt: '2026-01-01',
  ...over,
});

beforeEach(() => {
  loadExpenses.mockClear();
});

describe('useAllTripsData', () => {
  it('loads every given trip\'s expenses keyed by id', async () => {
    const trips = [trip(), trip({ id: 't2', name: 'Second' })];
    const { result } = renderHook(() => useAllTripsData(trips));

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.expensesByTripId).toEqual(expensesByTrip);
  });

  it('setExpensesForTrip patches one entry without touching others', async () => {
    const trips = [trip(), trip({ id: 't2', name: 'Second' })];
    const { result } = renderHook(() => useAllTripsData(trips));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.setExpensesForTrip('t1', []);
    });

    expect(result.current.expensesByTripId.t1).toEqual([]);
    expect(result.current.expensesByTripId.t2).toEqual(expensesByTrip.t2);
  });

  it('adding/removing a trip triggers a refetch', async () => {
    const trips = [trip()];
    const { result, rerender } = renderHook(({ trips }) => useAllTripsData(trips), {
      initialProps: { trips },
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    loadExpenses.mockClear();

    rerender({ trips: [trip(), trip({ id: 't2', name: 'Second' })] });

    await waitFor(() => expect(loadExpenses).toHaveBeenCalledWith('t2'));
  });

  it('an unrelated metadata-only change (same id set) does not trigger a refetch', async () => {
    const trips = [trip()];
    const { result, rerender } = renderHook(({ trips }) => useAllTripsData(trips), {
      initialProps: { trips },
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    loadExpenses.mockClear();

    // Same trip id, new array reference/renamed — mirrors useTrips's
    // setTrips(prev => prev.map(...)) pattern producing a new reference.
    rerender({ trips: [trip({ name: 'Renamed' })] });

    expect(loadExpenses).not.toHaveBeenCalled();
  });
});
