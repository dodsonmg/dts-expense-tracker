import { describe, it, expect } from 'vitest';
import { targetDimensions } from './photo';

// Only the pure sizing math is covered here. compressImage's
// createImageBitmap/canvas/toBlob path cannot run under jsdom (no canvas
// implementation, and no `canvas` package installed) — it is verified in a
// real browser via the verifier-gui skill and on-device. Deliberately not
// faked with a polyfill: a stubbed canvas would assert nothing about the
// encoding that actually matters.
describe('targetDimensions', () => {
  it('leaves an image already within the limit untouched', () => {
    expect(targetDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('leaves an image exactly at the limit untouched', () => {
    expect(targetDimensions(1600, 1200, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('scales a landscape image by its width', () => {
    expect(targetDimensions(4000, 3000, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('scales a portrait image by its height — the usual receipt shape', () => {
    expect(targetDimensions(3000, 4000, 1600)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it('preserves aspect ratio on a square image', () => {
    expect(targetDimensions(3000, 3000, 1600)).toEqual({
      width: 1600,
      height: 1600,
    });
  });

  it('never collapses an extreme aspect ratio to a zero-width edge', () => {
    const { width, height } = targetDimensions(10000, 5, 1600);
    expect(height).toBeGreaterThanOrEqual(1);
    expect(width).toBe(1600);
  });
});
