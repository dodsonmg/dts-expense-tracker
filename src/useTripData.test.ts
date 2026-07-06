import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTripData } from './useTripData';
import { __clearForTests, saveExpenses } from './db';
import * as db from './db';

beforeEach(async () => {
  await __clearForTests();
  vi.restoreAllMocks();
});

describe('useTripData', () => {
  it('loads the given trip\'s data on mount', async () => {
    await saveExpenses('t1', [
      {
        id: 'e',
        date: '2026-07-01',
        category: 'LODGING',
        amount_gbp: null,
        amount_usd: 10,
        payment: 'GTCC',
        note: 'seed',
        entered: false,
        miles: null,
        rate: null,
      },
    ]);

    const { result } = renderHook(() => useTripData('t1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.expenses[0].note).toBe('seed');
  });

  it('reloads and swaps data when tripId changes, without cross-saving', async () => {
    await saveExpenses('t1', [
      {
        id: 'e1',
        date: '2026-07-01',
        category: 'LODGING',
        amount_gbp: null,
        amount_usd: 1,
        payment: 'GTCC',
        note: 'trip one',
        entered: false,
        miles: null,
        rate: null,
      },
    ]);
    await saveExpenses('t2', []);

    const saveSpy = vi.spyOn(db, 'saveExpenses');

    const { result, rerender } = renderHook(
      ({ tripId }) => useTripData(tripId),
      { initialProps: { tripId: 't1' } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.expenses[0].note).toBe('trip one');

    rerender({ tripId: 't2' });
    await waitFor(() => expect(result.current.expenses).toHaveLength(0));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // The switch must never have persisted trip one's data under trip two's key.
    expect(saveSpy).not.toHaveBeenCalledWith(
      't2',
      expect.arrayContaining([expect.objectContaining({ note: 'trip one' })]),
    );
  });

  it('reloads from storage when reloadEpoch changes for the same tripId', async () => {
    await saveExpenses('t1', []);
    const { result, rerender } = renderHook(
      ({ tripId, epoch }: { tripId: string; epoch: number }) =>
        useTripData(tripId, epoch),
      { initialProps: { tripId: 't1', epoch: 0 } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // Simulate a whole-device restore writing new data directly to storage.
    await saveExpenses('t1', [
      {
        id: 'e2',
        date: '2026-07-02',
        category: 'OTHER',
        amount_gbp: null,
        amount_usd: 5,
        payment: 'personal',
        note: 'restored',
        entered: false,
        miles: null,
        rate: null,
      },
    ]);

    act(() => rerender({ tripId: 't1', epoch: 1 }));
    await waitFor(() => expect(result.current.expenses).toHaveLength(1));
    expect(result.current.expenses[0].note).toBe('restored');
  });
});
