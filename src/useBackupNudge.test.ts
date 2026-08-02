import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBackupNudge } from './useBackupNudge';
import type { LastBackupInfo } from './db';

let stored: LastBackupInfo | null = null;
const saveLastBackup = vi.fn((info: LastBackupInfo) => {
  stored = info;
  return Promise.resolve();
});

vi.mock('./db', () => ({
  loadLastBackup: () => Promise.resolve(stored),
  saveLastBackup: (info: LastBackupInfo) => saveLastBackup(info),
}));

const DAY = 86_400_000;

beforeEach(() => {
  stored = null;
  saveLastBackup.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBackupNudge', () => {
  it('never backed up + few expenses: does not nudge', async () => {
    const { result } = renderHook(() => useBackupNudge({ t1: [] as never[] }, true));
    await waitFor(() => expect(result.current.lastBackup).toBeNull());
    expect(result.current.shouldNudge).toBe(false);
  });

  it('never backed up + many expenses: nudges', async () => {
    const expenses = Array.from({ length: 6 }, (_, i) => i);
    const { result } = renderHook(() =>
      useBackupNudge({ t1: expenses as unknown as never[] }, true),
    );
    await waitFor(() => expect(result.current.shouldNudge).toBe(true));
  });

  it('recent backup + many edits but under the day threshold: does not nudge', async () => {
    stored = { at: new Date(Date.now() - 1 * DAY).toISOString(), expenseCount: 0 };
    const expenses = Array.from({ length: 10 }, (_, i) => i);
    const { result } = renderHook(() =>
      useBackupNudge({ t1: expenses as unknown as never[] }, true),
    );
    await waitFor(() => expect(result.current.lastBackup).not.toBeNull());
    expect(result.current.shouldNudge).toBe(false);
  });

  it('old backup + few edits: does not nudge', async () => {
    stored = { at: new Date(Date.now() - 30 * DAY).toISOString(), expenseCount: 2 };
    const { result } = renderHook(() =>
      useBackupNudge({ t1: [0, 1] as unknown as never[] }, true),
    );
    await waitFor(() => expect(result.current.lastBackup).not.toBeNull());
    expect(result.current.shouldNudge).toBe(false);
  });

  it('both thresholds crossed: nudges', async () => {
    stored = { at: new Date(Date.now() - 30 * DAY).toISOString(), expenseCount: 0 };
    const expenses = Array.from({ length: 10 }, (_, i) => i);
    const { result } = renderHook(() =>
      useBackupNudge({ t1: expenses as unknown as never[] }, true),
    );
    await waitFor(() => expect(result.current.shouldNudge).toBe(true));
  });

  it('not loaded yet: does not nudge even if thresholds are crossed', async () => {
    stored = { at: new Date(Date.now() - 30 * DAY).toISOString(), expenseCount: 0 };
    const expenses = Array.from({ length: 10 }, (_, i) => i);
    const { result } = renderHook(() =>
      useBackupNudge({ t1: expenses as unknown as never[] }, false),
    );
    await waitFor(() => expect(result.current.lastBackup).not.toBeNull());
    expect(result.current.shouldNudge).toBe(false);
  });

  it('sums expenses across every trip for the edit count', async () => {
    stored = { at: new Date(Date.now() - 30 * DAY).toISOString(), expenseCount: 0 };
    const { result } = renderHook(() =>
      useBackupNudge(
        { t1: [0, 1, 2] as unknown as never[], t2: [0, 1, 2] as unknown as never[] },
        true,
      ),
    );
    await waitFor(() => expect(result.current.shouldNudge).toBe(true));
  });

  it('dismiss() does not persist — a fresh hook instance still evaluates true', async () => {
    stored = { at: new Date(Date.now() - 30 * DAY).toISOString(), expenseCount: 0 };
    const expenses = Array.from({ length: 10 }, (_, i) => i);
    const { result } = renderHook(() =>
      useBackupNudge({ t1: expenses as unknown as never[] }, true),
    );
    await waitFor(() => expect(result.current.shouldNudge).toBe(true));

    act(() => result.current.dismiss());
    expect(result.current.shouldNudge).toBe(false);

    const fresh = renderHook(() => useBackupNudge({ t1: expenses as unknown as never[] }, true));
    await waitFor(() => expect(fresh.result.current.shouldNudge).toBe(true));
  });

  it('markBackedUp() resets both counters', async () => {
    stored = { at: new Date(Date.now() - 30 * DAY).toISOString(), expenseCount: 0 };
    const expenses = Array.from({ length: 10 }, (_, i) => i);
    const { result } = renderHook(() =>
      useBackupNudge({ t1: expenses as unknown as never[] }, true),
    );
    await waitFor(() => expect(result.current.shouldNudge).toBe(true));

    act(() => result.current.markBackedUp());

    expect(saveLastBackup).toHaveBeenCalledWith(
      expect.objectContaining({ expenseCount: 10 }),
    );
    expect(result.current.shouldNudge).toBe(false);
  });
});
