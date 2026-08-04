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
        photoIds: [],
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
        photoIds: [],
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
        photoIds: [],
      },
    ]);

    act(() => rerender({ tripId: 't1', epoch: 1 }));
    await waitFor(() => expect(result.current.expenses).toHaveLength(1));
    expect(result.current.expenses[0].note).toBe('restored');
  });
});

describe('useTripData — receipt photos', () => {
  const newExpense = (note: string) => ({
    date: '2026-07-01',
    category: 'LODGING' as const,
    amount_gbp: null,
    amount_usd: 10,
    payment: 'GTCC' as const,
    note,
    entered: false,
    miles: null,
    rate: null,
    photoIds: [],
  });

  const blob = (text: string) => new Blob([text], { type: 'image/jpeg' });

  async function mounted() {
    await saveExpenses('t1', []);
    const { result } = renderHook(() => useTripData('t1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    return result;
  }

  it('attaches a photo to an expense added in the same tick', async () => {
    const result = await mounted();

    // The ordering EntryForm depends on: addExpense returns the id
    // synchronously, so a photo can be attached before React re-renders.
    let id = '';
    act(() => {
      id = result.current.addExpense(newExpense('with receipt'));
      result.current.attachPhoto(id, blob('receipt bytes'));
    });

    await waitFor(() =>
      expect(result.current.expenses[0].photoIds).toHaveLength(1),
    );
    const photoId = result.current.expenses[0].photoIds[0];
    await waitFor(async () =>
      expect(await db.loadPhoto('t1', photoId)).not.toBeNull(),
    );
    expect(await (await db.loadPhoto('t1', photoId))!.text()).toBe('receipt bytes');
  });

  it('replacing a photo deletes the superseded blob', async () => {
    const result = await mounted();

    let id = '';
    act(() => {
      id = result.current.addExpense(newExpense('row'));
      result.current.attachPhoto(id, blob('first'));
    });
    await waitFor(() =>
      expect(result.current.expenses[0].photoIds).toHaveLength(1),
    );
    const firstId = result.current.expenses[0].photoIds[0];

    act(() => result.current.attachPhoto(id, blob('second')));
    await waitFor(() =>
      expect(result.current.expenses[0].photoIds[0]).not.toBe(firstId),
    );
    const secondId = result.current.expenses[0].photoIds[0];

    await waitFor(async () =>
      expect(await db.loadPhoto('t1', firstId)).toBeNull(),
    );
    expect(await (await db.loadPhoto('t1', secondId))!.text()).toBe('second');
  });

  it('removePhoto clears the reference and deletes the blob', async () => {
    const result = await mounted();

    let id = '';
    act(() => {
      id = result.current.addExpense(newExpense('row'));
      result.current.attachPhoto(id, blob('bytes'));
    });
    await waitFor(() =>
      expect(result.current.expenses[0].photoIds).toHaveLength(1),
    );
    const photoId = result.current.expenses[0].photoIds[0];

    act(() => result.current.removePhoto(id));

    await waitFor(() =>
      expect(result.current.expenses[0].photoIds).toEqual([]),
    );
    await waitFor(async () =>
      expect(await db.loadPhoto('t1', photoId)).toBeNull(),
    );
  });

  it('deleting an expense sweeps its photo blob', async () => {
    const result = await mounted();

    let id = '';
    act(() => {
      id = result.current.addExpense(newExpense('row'));
      result.current.attachPhoto(id, blob('bytes'));
    });
    await waitFor(() =>
      expect(result.current.expenses[0].photoIds).toHaveLength(1),
    );
    const photoId = result.current.expenses[0].photoIds[0];

    act(() => result.current.deleteExpense(id));

    await waitFor(() => expect(result.current.expenses).toHaveLength(0));
    await waitFor(async () =>
      expect(await db.loadPhoto('t1', photoId)).toBeNull(),
    );
  });

  it('getPhoto reads back a photo scoped to the active trip', async () => {
    const result = await mounted();

    let id = '';
    act(() => {
      id = result.current.addExpense(newExpense('row'));
      result.current.attachPhoto(id, blob('scoped'));
    });
    await waitFor(() =>
      expect(result.current.expenses[0].photoIds).toHaveLength(1),
    );
    const photoId = result.current.expenses[0].photoIds[0];

    await waitFor(async () =>
      expect(await result.current.getPhoto(photoId)).not.toBeNull(),
    );
    expect(await (await result.current.getPhoto(photoId))!.text()).toBe('scoped');
  });
});
