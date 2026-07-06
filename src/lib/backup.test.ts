import { describe, it, expect } from 'vitest';
import {
  backupFilename,
  BackupParseError,
  buildBackup,
  parseBackup,
} from './backup';
import type { Expense, MieSegment } from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: 12.5,
  amount_usd: 16,
  payment: 'GTCC',
  note: 'taxi',
  entered: true,
  miles: null,
  rate: null,
  ...over,
});

const seg = (over: Partial<MieSegment> = {}): MieSegment => ({
  id: 's',
  location: 'London',
  full_rate: 100,
  partial_rate: 75,
  full_days: 2,
  partial_days: 1,
  ...over,
});

describe('buildBackup / parseBackup', () => {
  it('round-trips expenses, segments, and DTS totals losslessly', () => {
    const expenses = [exp()];
    const segments = [seg()];
    const dtsExpected = { LODGING: 16 };
    const dtsAccountExpected = { gtcc: 16, personal: null };

    const json = buildBackup(expenses, segments, dtsExpected, dtsAccountExpected);
    const parsed = parseBackup(json);

    expect(parsed.expenses).toEqual(expenses);
    expect(parsed.segments).toEqual(segments);
    expect(parsed.dtsExpected).toEqual(dtsExpected);
    expect(parsed.dtsAccountExpected).toEqual(dtsAccountExpected);
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).not.toBe('');
  });

  it('names the file with today\'s date', () => {
    const name = backupFilename(new Date('2026-07-06T12:00:00Z'));
    expect(name).toBe('dts-backup-2026-07-06.json');
  });

  it('rejects malformed JSON', () => {
    expect(() => parseBackup('not json')).toThrow(BackupParseError);
  });

  it('rejects a well-formed JSON file missing the expected shape', () => {
    expect(() => parseBackup(JSON.stringify({ foo: 'bar' }))).toThrow(
      BackupParseError,
    );
  });

  it('rejects expenses that are missing required fields', () => {
    const bad = JSON.stringify({
      version: 1,
      exportedAt: '',
      expenses: [{ id: 'e' }],
      segments: [],
      dtsExpected: {},
      dtsAccountExpected: { gtcc: null, personal: null },
    });
    expect(() => parseBackup(bad)).toThrow(BackupParseError);
  });

  it('rejects a backup from a newer app version', () => {
    const future = JSON.stringify({
      version: 999,
      exportedAt: '',
      expenses: [],
      segments: [],
      dtsExpected: {},
      dtsAccountExpected: { gtcc: null, personal: null },
    });
    expect(() => parseBackup(future)).toThrow(BackupParseError);
  });
});
