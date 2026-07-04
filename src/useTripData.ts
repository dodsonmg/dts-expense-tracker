import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Account,
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

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Loads the trip from IndexedDB once, keeps it in React state, and persists any
// change back. Persistence is skipped until the initial load completes so we
// never overwrite stored data with the empty initial state.
export function useTripData() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [segments, setSegments] = useState<MieSegment[]>([]);
  const [dtsExpected, setDtsExpectedState] = useState<DtsExpected>({});
  const [dtsAccountExpected, setDtsAccountExpectedState] =
    useState<DtsAccountExpected>({ gtcc: null, personal: null });
  const [loaded, setLoaded] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      loadExpenses(),
      loadSegments(),
      loadDtsExpected(),
      loadDtsAccountExpected(),
    ]).then(([e, s, d, a]) => {
      if (!alive) return;
      setExpenses(e);
      setSegments(s);
      setDtsExpectedState(d);
      setDtsAccountExpectedState(a);
      ready.current = true;
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ready.current) void saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    if (ready.current) void saveSegments(segments);
  }, [segments]);

  useEffect(() => {
    if (ready.current) void saveDtsExpected(dtsExpected);
  }, [dtsExpected]);

  useEffect(() => {
    if (ready.current) void saveDtsAccountExpected(dtsAccountExpected);
  }, [dtsAccountExpected]);

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

  // Set one DTS-expected account reimbursement total (USD). null clears it.
  const setDtsAccountExpected = useCallback(
    (account: Account, value: number | null) => {
      setDtsAccountExpectedState((prev) => ({ ...prev, [account]: value }));
    },
    [],
  );

  return {
    loaded,
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
