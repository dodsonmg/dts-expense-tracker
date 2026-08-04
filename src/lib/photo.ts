// Receipt photo compression. An iPhone photo is 2-5 MB; a trip's worth of
// those would bloat IndexedDB and make the zip export slow to build and email.
// Downscaling to a legible-receipt size gets a typical photo into the low
// hundreds of KB, which keeps both usable.
//
// Only `targetDimensions` is unit-testable: jsdom implements no <canvas>, so
// the draw/encode path in `compressImage` has to be verified in a real browser
// (the verifier-gui skill) or on-device. Component tests mock this module.

export interface CompressOptions {
  maxDimension?: number; // longest edge in px
  quality?: number; // JPEG quality, 0-1
}

// Big enough that receipt text stays readable when zoomed at the office,
// small enough that a trip's photos stay emailable.
export const DEFAULT_MAX_DIMENSION = 1600;
export const DEFAULT_QUALITY = 0.72;

export const PHOTO_MIME = 'image/jpeg';

// Scales the longest edge down to `maxDimension`, preserving aspect ratio.
// Never scales up — a photo already smaller than the target is left alone.
export function targetDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  // Round rather than floor so a 1px edge doesn't collapse to 0.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Downscales and re-encodes an image file as JPEG. `imageOrientation:
// 'from-image'` applies the EXIF rotation an iPhone writes, so a photo taken
// sideways isn't stored sideways — without it the bitmap keeps raw sensor
// orientation and the canvas draw bakes that in permanently.
export async function compressImage(
  file: Blob,
  opts: CompressOptions = {},
): Promise<Blob> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const { width, height } = targetDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get a 2d canvas context.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, PHOTO_MIME, quality);
    });
    if (!blob) throw new Error('Could not encode the image.');
    return blob;
  } finally {
    bitmap.close();
  }
}
