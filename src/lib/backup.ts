import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';

// Whole-state backup/restore (issue #7) — distinct from csv.ts/xlsx.ts, which
// are lossy views for the office. This round-trips everything db.ts persists
// so a device loss/replacement can be recovered exactly. `version` exists so a
// future release can migrate an older backup instead of guessing its shape.
const BACKUP_VERSION = 1;

export interface Backup {
  version: number;
  exportedAt: string; // ISO timestamp, informational only
  expenses: Expense[];
  segments: MieSegment[];
  dtsExpected: DtsExpected;
  dtsAccountExpected: DtsAccountExpected;
}

export function buildBackup(
  expenses: Expense[],
  segments: MieSegment[],
  dtsExpected: DtsExpected,
  dtsAccountExpected: DtsAccountExpected,
  now = new Date(),
): string {
  const backup: Backup = {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    expenses,
    segments,
    dtsExpected,
    dtsAccountExpected,
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

// Parses and structurally validates a backup file's text. Throws
// BackupParseError with a user-presentable message on anything malformed;
// never returns a partially-valid result.
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
  if (!Array.isArray(b.expenses) || !b.expenses.every(isExpense)) {
    throw new BackupParseError('Backup file is missing valid expenses.');
  }
  if (!Array.isArray(b.segments) || !b.segments.every(isSegment)) {
    throw new BackupParseError('Backup file is missing valid M&IE segments.');
  }
  if (typeof b.dtsExpected !== 'object' || b.dtsExpected === null) {
    throw new BackupParseError('Backup file is missing DTS category totals.');
  }
  if (
    typeof b.dtsAccountExpected !== 'object' ||
    b.dtsAccountExpected === null
  ) {
    throw new BackupParseError('Backup file is missing DTS account totals.');
  }

  return {
    version: b.version,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    expenses: b.expenses,
    segments: b.segments,
    dtsExpected: b.dtsExpected as DtsExpected,
    dtsAccountExpected: b.dtsAccountExpected as DtsAccountExpected,
  };
}
