import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip, TripBackup } from './types';
import {
  deleteTripStorage,
  ensureInitialized,
  loadDtsAccountExpected,
  loadDtsExpected,
  loadExpenses,
  loadSegments,
  saveActiveTripId,
  saveAllTripsData,
  saveTrips,
} from './db';
import { newId } from './lib/id';
import type { Backup } from './lib/backup';

// Owns the trip list and which one is active — separate from useTripData,
// which owns one trip's expenses/segments/DTS totals. A device always has at
// least one trip; ensureInitialized (db.ts) guarantees that on first load,
// migrating any pre-multi-trip data into a synthetic first trip.
export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripIdState] = useState('');
  const [loaded, setLoaded] = useState(false);
  // Bumped by restoreFromBackup to force useTripData to re-fetch from storage
  // even when activeTripId doesn't change (a restore preserves trip ids).
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const ready = useRef(false);

  useEffect(() => {
    void ensureInitialized().then(({ trips, activeTripId }) => {
      setTrips(trips);
      setActiveTripIdState(activeTripId);
      ready.current = true;
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (ready.current) void saveTrips(trips);
  }, [trips]);

  useEffect(() => {
    if (ready.current) void saveActiveTripId(activeTripId);
  }, [activeTripId]);

  const selectTrip = useCallback((id: string) => {
    setActiveTripIdState(id);
  }, []);

  const createTrip = useCallback((name: string) => {
    const trip: Trip = {
      id: newId(),
      name: name.trim() || 'New trip',
      createdAt: new Date().toISOString(),
    };
    setTrips((prev) => [...prev, trip]);
    setActiveTripIdState(trip.id);
    return trip.id;
  }, []);

  const renameTrip = useCallback((id: string, name: string) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)),
    );
  }, []);

  // No-ops if this is the last remaining trip — a device always has >=1.
  const deleteTrip = useCallback((id: string) => {
    setTrips((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== id);
      void deleteTripStorage(id);
      setActiveTripIdState((cur) => (cur === id ? next[0].id : cur));
      return next;
    });
  }, []);

  // Archiving never deletes data and is reversible, unlike deleteTrip — no
  // "last trip" guard here. Archiving the active trip falls back to another
  // visible trip if one exists; if it was the last non-archived trip,
  // activeTripId stays put (an archived-and-active trip still works
  // normally in every tab).
  const setArchived = useCallback((id: string, archived: boolean) => {
    setTrips((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, archived } : t));
      if (archived) {
        setActiveTripIdState((cur) => {
          if (cur !== id) return cur;
          const fallback = next.find((t) => t.id !== id && !t.archived);
          return fallback?.id ?? cur;
        });
      }
      return next;
    });
  }, []);

  // Whole-device restore (issue #7 v2). Writes every trip's data directly to
  // storage, replaces the trip list/active id, and bumps reloadEpoch so
  // useTripData re-fetches even if activeTripId happens not to change.
  const restoreFromBackup = useCallback(async (backup: Backup) => {
    await saveAllTripsData(backup.trips);
    const newTrips: Trip[] = backup.trips.map(({ id, name, createdAt, archived }) => ({
      id,
      name,
      createdAt,
      archived,
    }));
    setTrips(newTrips);
    setActiveTripIdState(newTrips[0]?.id ?? '');
    setReloadEpoch((n) => n + 1);
  }, []);

  // Reads every trip's full data from storage — only for building a
  // whole-device backup, not on every render.
  const loadAllTripsData = useCallback(async (): Promise<TripBackup[]> => {
    return Promise.all(
      trips.map(async (t) => ({
        ...t,
        expenses: await loadExpenses(t.id),
        segments: await loadSegments(t.id),
        dtsExpected: await loadDtsExpected(t.id),
        dtsAccountExpected: await loadDtsAccountExpected(t.id),
      })),
    );
  }, [trips]);

  return {
    loaded,
    trips,
    activeTripId,
    reloadEpoch,
    selectTrip,
    createTrip,
    renameTrip,
    deleteTrip,
    setArchived,
    restoreFromBackup,
    loadAllTripsData,
  };
}

export type Trips = ReturnType<typeof useTrips>;
