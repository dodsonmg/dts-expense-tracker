import { describe, it, expect } from 'vitest';
import { segmentTotal, mieTotalUsd } from './mie';
import type { MieSegment } from '../types';

const seg = (over: Partial<MieSegment> = {}): MieSegment => ({
  id: 'x',
  location: 'RAF Mildenhall',
  full_rate: 100,
  partial_rate: 75,
  full_days: 3,
  partial_days: 2,
  ...over,
});

describe('segmentTotal', () => {
  it('is full_rate*full_days + partial_rate*partial_days', () => {
    // 100*3 + 75*2 = 450
    expect(segmentTotal(seg())).toBe(450);
  });

  it('ignores the location label', () => {
    expect(segmentTotal(seg({ location: 'anywhere' }))).toBe(450);
  });

  it('is zero when there are no days', () => {
    expect(segmentTotal(seg({ full_days: 0, partial_days: 0 }))).toBe(0);
  });
});

describe('mieTotalUsd', () => {
  it('chains across every segment', () => {
    const total = mieTotalUsd([
      seg({ id: 'a' }), // 450
      seg({ id: 'b', full_rate: 50, partial_rate: 0, full_days: 1, partial_days: 0 }), // 50
    ]);
    expect(total).toBe(500);
  });

  it('is zero for no segments', () => {
    expect(mieTotalUsd([])).toBe(0);
  });
});
