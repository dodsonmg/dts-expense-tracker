import { useEffect, useMemo, useState } from 'react';
import type { Expense } from './types';
import { loadLastBackup, saveLastBackup, type LastBackupInfo } from './db';

const DAYS_THRESHOLD = 7;
const EDITS_THRESHOLD = 5;

// Nudges toward a backup only once both a time and an edit-count threshold
// are crossed, so light users (who haven't touched the app, or who back up
// often) aren't nagged. dismiss() is session-only (mirrors UpdateToast's
// setNeedRefresh(false)) — it hides for this session and reappears next load
// if still overdue, no permanent snooze.
export function useBackupNudge(expensesByTripId: Record<string, Expense[]>, loaded: boolean) {
  const [lastBackup, setLastBackup] = useState<LastBackupInfo | null>(null);
  const [lastBackupLoaded, setLastBackupLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Snapshotted once via the lazy initializer (mirrors EntryForm's
  // useState(today)) rather than calling Date.now() directly in the hook
  // body, which would be an impure render.
  const [now] = useState(Date.now);

  useEffect(() => {
    void loadLastBackup().then((info) => {
      setLastBackup(info);
      setLastBackupLoaded(true);
    });
  }, []);

  const currentCount = useMemo(
    () => Object.values(expensesByTripId).reduce((n, list) => n + list.length, 0),
    [expensesByTripId],
  );

  const daysSinceBackup = lastBackup
    ? (now - Date.parse(lastBackup.at)) / 86_400_000
    : Infinity;
  const editsSinceBackup = lastBackup
    ? Math.abs(currentCount - lastBackup.expenseCount)
    : currentCount;

  const shouldNudge =
    loaded &&
    lastBackupLoaded &&
    !dismissed &&
    daysSinceBackup >= DAYS_THRESHOLD &&
    editsSinceBackup >= EDITS_THRESHOLD;

  function dismiss() {
    setDismissed(true);
  }

  function markBackedUp() {
    const info: LastBackupInfo = { at: new Date().toISOString(), expenseCount: currentCount };
    void saveLastBackup(info);
    setLastBackup(info);
    setDismissed(false);
  }

  return { shouldNudge, daysSinceBackup, lastBackup, dismiss, markBackedUp };
}
