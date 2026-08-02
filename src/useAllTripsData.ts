import { useCallback, useEffect, useState } from 'react';
import type { Expense, Trip } from './types';
import { loadExpenses } from './db';

// Read-only, cross-trip counterpart to useTripData (which is single-trip,
// read-write, and persists on every change). Loads every given trip's
// expenses for the backup nudge's edit count — never writes back to storage.
//
// The reload effect is keyed on the *sorted set of trip ids*, not the raw
// `trips` array reference, so renaming/archiving a trip (which produces a
// new array reference via useTrips's map-based setters) doesn't trigger a
// wasted IndexedDB re-read on every keystroke. It only reruns when a trip is
// actually added, removed, or restored.
export function useAllTripsData(trips: Trip[]) {
  const [expensesByTripId, setExpensesByTripId] = useState<
    Record<string, Expense[]>
  >({});
  // Compared against tripIdKey below (mirrors useTripData's loadedFor/ready
  // pair) rather than a plain boolean set at the top of the effect, so
  // "loaded" never needs a synchronous setState(false) inside the effect
  // body.
  const [loadedForKey, setLoadedForKey] = useState<string | null>(null);

  const tripIdKey = trips
    .map((t) => t.id)
    .sort()
    .join(',');
  const loaded = loadedForKey === tripIdKey;

  useEffect(() => {
    let alive = true;
    void Promise.all(
      trips.map((t) => loadExpenses(t.id).then((e) => [t.id, e] as const)),
    ).then((entries) => {
      if (!alive) return;
      setExpensesByTripId(Object.fromEntries(entries));
      setLoadedForKey(tripIdKey);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload is keyed on tripIdKey deliberately, not the trips array reference
  }, [tripIdKey]);

  // Lets the app patch in the active trip's live, already-saved expenses
  // (from useTripData) without a redundant IndexedDB read — the active trip
  // is the only one whose expenses can change without the trip-id set
  // changing.
  const setExpensesForTrip = useCallback(
    (tripId: string, expenses: Expense[]) => {
      setExpensesByTripId((prev) => ({ ...prev, [tripId]: expenses }));
    },
    [],
  );

  return { loaded, expensesByTripId, setExpensesForTrip };
}
