import { describe, it, expect } from 'vitest';
import {
  targetDimensions,
  prepareAttachment,
  isPdf,
  isImageAttachment,
  AttachmentTooLargeError,
  MAX_PDF_BYTES,
  PDF_MIME,
} from './photo';

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

describe('isPdf / isImageAttachment', () => {
  it('recognizes a PDF blob by its MIME type', () => {
    expect(isPdf(new Blob([], { type: PDF_MIME }))).toBe(true);
    expect(isPdf(new Blob([], { type: 'image/jpeg' }))).toBe(false);
  });

  it('recognizes any image/* type', () => {
    expect(isImageAttachment('image/jpeg')).toBe(true);
    expect(isImageAttachment('image/png')).toBe(true);
    expect(isImageAttachment('application/pdf')).toBe(false);
  });
});

// prepareAttachment's PDF branch touches no canvas/DOM, unlike compressImage,
// so it's fully testable under jsdom.
describe('prepareAttachment (PDF branch)', () => {
  it('stores a PDF under the size cap unchanged, without re-encoding', async () => {
    const file = new Blob(['%PDF-1.4 fake pdf bytes'], { type: PDF_MIME });
    const result = await prepareAttachment(file);
    expect(result).toBe(file);
  });

  it('rejects a PDF over MAX_PDF_BYTES with AttachmentTooLargeError', async () => {
    const oversized = new Blob([new Uint8Array(MAX_PDF_BYTES + 1)], {
      type: PDF_MIME,
    });
    await expect(prepareAttachment(oversized)).rejects.toBeInstanceOf(
      AttachmentTooLargeError,
    );
  });

  it('accepts a PDF exactly at the size cap', async () => {
    const exact = new Blob([new Uint8Array(MAX_PDF_BYTES)], { type: PDF_MIME });
    await expect(prepareAttachment(exact)).resolves.toBe(exact);
  });
});
