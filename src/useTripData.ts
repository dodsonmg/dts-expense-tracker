import { useCallback, useEffect, useState } from 'react';
import type {
  Category,
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from './types';
import {
  loadDtsAccountExpected,
  loadDtsExpected,
  loadExpenses,
  loadSegments,
  saveDtsAccountExpected,
  saveDtsExpected,
  saveExpenses,
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

  const addExpense = useCallback((data: Omit<Expense, 'id'>) => {
    setExpenses((prev) => [{ ...data, id: newId() }, ...prev]);
  }, []);

  const updateExpense = useCallback((id: string, patch: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

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
    addSegment,
    updateSegment,
    deleteSegment,
    setDtsExpected,
    setDtsAccountExpected,
  };
}

export type TripData = ReturnType<typeof useTripData>;
