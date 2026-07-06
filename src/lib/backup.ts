import type { DtsAccountExpected, DtsExpected, Expense, MieSegment, TripBackup } from '../types';
import { newId } from './id';

// Whole-device backup/restore (issue #7) — distinct from csv.ts/xlsx.ts, which
// are lossy per-trip views for the office. This round-trips every trip's data
// so a device loss/replacement can be recovered exactly. `version` exists so
// this module can migrate an older backup instead of guessing its shape.
//
// v1 (pre-multi-trip) was a single flat trip's worth of data at the top
// level; v2 wraps N trips, each carrying its own identity (id/name/createdAt)
// plus the same four data fields. parseBackup migrates v1 into a v2 shape
// with one synthetic trip, so old backups keep working.
const BACKUP_VERSION = 2;

export interface Backup {
  version: number;
  exportedAt: string; // ISO timestamp, informational only
  trips: TripBackup[];
}

export function buildBackup(trips: TripBackup[], now = new Date()): string {
  const backup: Backup = {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    trips,
  };
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(now = new Date()): string {
  return `dts-backup-${now.toISOString().slice(0, 10)}.json`;
}

export class BackupParseError extends Error {}

function isExpense(v: unknown): v is Expense {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.category === 'string' &&
    typeof e.payment === 'string' &&
    typeof e.note === 'string'
  );
}

function isSegment(v: unknown): v is MieSegment {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.location === 'string';
}

function validateTripData(
  b: Record<string, unknown>,
  label: string,
): {
  expenses: Expense[];
  segments: MieSegment[];
  dtsExpected: DtsExpected;
  dtsAccountExpected: DtsAccountExpected;
} {
  if (!Array.isArray(b.expenses) || !b.expenses.every(isExpense)) {
    throw new BackupParseError(`${label} is missing valid expenses.`);
  }
  if (!Array.isArray(b.segments) || !b.segments.every(isSegment)) {
    throw new BackupParseError(`${label} is missing valid M&IE segments.`);
  }
  if (typeof b.dtsExpected !== 'object' || b.dtsExpected === null) {
    throw new BackupParseError(`${label} is missing DTS category totals.`);
  }
  if (
    typeof b.dtsAccountExpected !== 'object' ||
    b.dtsAccountExpected === null
  ) {
    throw new BackupParseError(`${label} is missing DTS account totals.`);
  }
  return {
    expenses: b.expenses,
    segments: b.segments,
    dtsExpected: b.dtsExpected as DtsExpected,
    dtsAccountExpected: b.dtsAccountExpected as DtsAccountExpected,
  };
}

// Parses and structurally validates a backup file's text. Throws
// BackupParseError with a user-presentable message on anything malformed;
// never returns a partially-valid result. Migrates a v1 (single flat trip)
// backup into a v2 shape wrapping one synthetic trip.
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupParseError('Not a valid JSON file.');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new BackupParseError('Not a valid backup file.');
  }
  const b = raw as Record<string, unknown>;

  if (typeof b.version !== 'number') {
    throw new BackupParseError('Not a valid backup file.');
  }
  if (b.version > BACKUP_VERSION) {
    throw new BackupParseError(
      'This backup was made by a newer version of the app.',
    );
  }
  const exportedAt = typeof b.exportedAt === 'string' ? b.exportedAt : '';

  if (b.version === 1) {
    const data = validateTripData(b, 'Backup file');
    return {
      version: BACKUP_VERSION,
      exportedAt,
      trips: [
        {
          id: newId(),
          name: 'Restored trip',
          createdAt: exportedAt || new Date().toISOString(),
          ...data,
        },
      ],
    };
  }

  if (!Array.isArray(b.trips)) {
    throw new BackupParseError('Backup file is missing valid trips.');
  }
  const trips: TripBackup[] = b.trips.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new BackupParseError(`Trip ${i + 1} is not valid.`);
    }
    const t = raw as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.createdAt !== 'string') {
      throw new BackupParseError(`Trip ${i + 1} is missing its id/name/createdAt.`);
    }
    const data = validateTripData(t, `Trip "${t.name}"`);
    return { id: t.id, name: t.name, createdAt: t.createdAt, ...data };
  });

  return { version: BACKUP_VERSION, exportedAt, trips };
}
