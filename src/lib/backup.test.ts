import { describe, it, expect } from 'vitest';
import {
  backupFilename,
  BackupParseError,
  buildBackup,
  parseBackup,
} from './backup';
import type { Expense, MieSegment, TripBackup } from '../types';

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

const tripBackup = (over: Partial<TripBackup> = {}): TripBackup => ({
  id: 't1',
  name: 'London Aug 2026',
  createdAt: '2026-08-01T00:00:00.000Z',
  expenses: [exp()],
  segments: [seg()],
  dtsExpected: { LODGING: 16 },
  dtsAccountExpected: { gtcc: 16, personal: null, total: null },
  ...over,
});

describe('buildBackup / parseBackup (v2, multi-trip)', () => {
  it('round-trips multiple trips losslessly', () => {
    const trips = [tripBackup(), tripBackup({ id: 't2', name: 'Ramstein Sep 2026', expenses: [] })];
    const json = buildBackup(trips);
    const parsed = parseBackup(json);

    expect(parsed.version).toBe(2);
    expect(parsed.trips).toEqual(trips);
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

  it('rejects a trip missing required expense fields', () => {
    const bad = JSON.stringify({
      version: 2,
      exportedAt: '',
      trips: [
        {
          id: 't1',
          name: 'Trip',
          createdAt: '2026-01-01',
          expenses: [{ id: 'e' }],
          segments: [],
          dtsExpected: {},
          dtsAccountExpected: { gtcc: null, personal: null },
        },
      ],
    });
    expect(() => parseBackup(bad)).toThrow(BackupParseError);
  });

  it('rejects a backup from a newer app version', () => {
    const future = JSON.stringify({ version: 999, exportedAt: '', trips: [] });
    expect(() => parseBackup(future)).toThrow(BackupParseError);
  });

  it('migrates a v1 (flat, single-trip) backup into one synthetic trip', () => {
    const v1 = JSON.stringify({
      version: 1,
      exportedAt: '2026-07-01T00:00:00.000Z',
      expenses: [exp()],
      segments: [seg()],
      dtsExpected: { LODGING: 16 },
      dtsAccountExpected: { gtcc: 16, personal: null },
    });

    const parsed = parseBackup(v1);

    expect(parsed.version).toBe(2);
    expect(parsed.trips).toHaveLength(1);
    expect(parsed.trips[0].name).toBe('Restored trip');
    expect(parsed.trips[0].expenses).toEqual([exp()]);
    expect(parsed.trips[0].segments).toEqual([seg()]);
    expect(parsed.trips[0].dtsExpected).toEqual({ LODGING: 16 });
    expect(parsed.trips[0].dtsAccountExpected).toEqual({
      gtcc: 16,
      personal: null,
      total: null, // v1 predates this field; defaults to null
    });
  });

  it('rejects a v1 backup that is missing required fields', () => {
    const badV1 = JSON.stringify({
      version: 1,
      exportedAt: '',
      expenses: [{ id: 'e' }],
      segments: [],
      dtsExpected: {},
      dtsAccountExpected: { gtcc: null, personal: null },
    });
    expect(() => parseBackup(badV1)).toThrow(BackupParseError);
  });
});
