import type { MieSegment } from '../types';

// M&IE total (USD) = Σ over segments of
//   full_rate × full_days + partial_rate × partial_days
// The `location` label never enters the summation. The chain runs across every
// segment. M&IE is USD only and always contributes to the Personal bucket.
export function segmentTotal(seg: MieSegment): number {
  return seg.full_rate * seg.full_days + seg.partial_rate * seg.partial_days;
}

export function mieTotalUsd(segments: MieSegment[]): number {
  return segments.reduce((sum, seg) => sum + segmentTotal(seg), 0);
}
