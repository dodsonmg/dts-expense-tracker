import { useCallback, useEffect, useState } from 'react';
import type {
  Category,
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from './types';
import {
  deletePhoto,
  loadDtsAccountExpected,
  loadDtsExpected,
  loadExpenses,
  loadPhoto,
  loadSegments,
  saveDtsAccountExpected,
  saveDtsExpected,
  saveExpenses,
  savePhoto,
  saveSegments,
} from './db';
import { newId } from './lib/id';

// Loads one trip's data from IndexedDB, keeps it in React state, and persists
// any change back. Persistence is skipped until the initial load completes so
// we never overwrite stored data with the empty initial state.
//
// Re-loads whenever `tripId` changes (switching trips) or `reloadEpoch`
// changes (a whole-device backup restore — the active trip id may not change,
// so a bump forces a re-fetch from storage).
export function useTripData(tripId: string, reloadEpoch = 0) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [segments, setSegments] = useState<MieSegment[]>([]);
  const [dtsExpected, setDtsExpectedState] = useState<DtsExpected>({});
  const [dtsAccountExpected, setDtsAccountExpectedState] =
    useState<DtsAccountExpected>({ gtcc: null, personal: null, total: null });
  // Which (tripId, reloadEpoch) pair the state above currently holds data
  // for, or null before the first load resolves. `ready` is derived by
  // comparing it against the current inputs — the instant tripId/reloadEpoch
  // changes, `loadedFor` still names the *previous* trip (nothing has updated
  // it yet), so `ready` is already false in that very render, before the
  // per-field save effects (also keyed on `tripId`) run in the same commit.
  // That's what stops a trip switch from saving the outgoing trip's
  // still-resident state under the new trip's key during the async load gap.
  const [loadedFor, setLoadedFor] = useState<{
    tripId: string;
    epoch: number;
  } | null>(null);
  const ready = loadedFor?.tripId === tripId && loadedFor.epoch === reloadEpoch;

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    void Promise.all([
      loadExpenses(tripId),
      loadSegments(tripId),
      loadDtsExpected(tripId),
      loadDtsAccountExpected(tripId),
    ]).then(([e, s, d, a]) => {
      if (!alive) return;
      setExpenses(e);
      setSegments(s);
      setDtsExpectedState(d);
      setDtsAccountExpectedState(a);
      setLoadedFor({ tripId, epoch: reloadEpoch });
    });
    return () => {
      alive = false;
    };
  }, [tripId, reloadEpoch]);

  useEffect(() => {
    if (ready) void saveExpenses(tripId, expenses);
  }, [ready, tripId, expenses]);

  useEffect(() => {
    if (ready) void saveSegments(tripId, segments);
  }, [ready, tripId, segments]);

  useEffect(() => {
    if (ready) void saveDtsExpected(tripId, dtsExpected);
  }, [ready, tripId, dtsExpected]);

  useEffect(() => {
    if (ready) void saveDtsAccountExpected(tripId, dtsAccountExpected);
  }, [ready, tripId, dtsAccountExpected]);

  // Returns the new expense's id so a caller can immediately associate
  // something with it — EntryForm needs this to attach a receipt photo to a
  // row it has only just created.
  const addExpense = useCallback((data: Omit<Expense, 'id'>): string => {
    const id = newId();
    setExpenses((prev) => [{ ...data, id }, ...prev]);
    return id;
  }, []);

  const updateExpense = useCallback((id: string, patch: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  // Photo blob IO deliberately sits *outside* the setExpenses updater, reading
  // current state from this closure instead of from `prev`. React re-invokes
  // updaters (Strict Mode) to catch impurity, which would fire these writes
  // twice; the state update itself still uses the updater form so it composes
  // correctly with any other queued update.
  const attachPhoto = useCallback(
    (expenseId: string, blob: Blob): void => {
      const photoId = newId();
      // Empty for a row added in this same tick (React hasn't re-rendered yet)
      // — correct, since a brand-new expense has no previous photo to sweep.
      const superseded = expenses.find((e) => e.id === expenseId)?.photoIds ?? [];
      setExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? { ...e, photoIds: [photoId] } : e)),
      );
      void savePhoto(tripId, photoId, blob).then(() =>
        Promise.all(superseded.map((pid) => deletePhoto(tripId, pid))),
      );
    },
    [expenses, tripId],
  );

  const removePhoto = useCallback(
    (expenseId: string): void => {
      const removed = expenses.find((e) => e.id === expenseId)?.photoIds ?? [];
      setExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? { ...e, photoIds: [] } : e)),
      );
      void Promise.all(removed.map((pid) => deletePhoto(tripId, pid)));
    },
    [expenses, tripId],
  );

  const getPhoto = useCallback(
    (photoId: string): Promise<Blob | null> => loadPhoto(tripId, photoId),
    [tripId],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      const orphaned = expenses.find((e) => e.id === id)?.photoIds ?? [];
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      void Promise.all(orphaned.map((pid) => deletePhoto(tripId, pid)));
    },
    [expenses, tripId],
  );

  const addSegment = useCallback((data: Omit<MieSegment, 'id'>) => {
    setSegments((prev) => [...prev, { ...data, id: newId() }]);
  }, []);

  const updateSegment = useCallback(
    (id: string, patch: Partial<MieSegment>) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const deleteSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Set one DTS-expected category total (USD). null clears it.
  const setDtsExpected = useCallback(
    (category: Category, value: number | null) => {
      setDtsExpectedState((prev) => ({ ...prev, [category]: value }));
    },
    [],
  );

  // Set one DTS-expected account reimbursement total (USD), or the
  // all-expenses `total` shown above the split. null clears it.
  const setDtsAccountExpected = useCallback(
    (key: keyof DtsAccountExpected, value: number | null) => {
      setDtsAccountExpectedState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return {
    loaded: ready,
    expenses,
    segments,
    dtsExpected,
    dtsAccountExpected,
    addExpense,
    updateExpense,
    deleteExpense,
    attachPhoto,
    removePhoto,
    getPhoto,
    addSegment,
    updateSegment,
    deleteSegment,
    setDtsExpected,
    setDtsAccountExpected,
  };
}

export type TripData = ReturnType<typeof useTripData>;
