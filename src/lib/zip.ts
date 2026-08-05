import { slugify } from './format';
import { PDF_MIME } from './photo';

// Bundles the formatted spreadsheet with the receipts it references, so the
// office workstation (phones banned, DTS open beside the sheet) has the
// evidence for each line right there: key row N into DTS, attach
// receipts/receipt-NN.jpg (or .pdf). The number comes from the Receipt # /
// receipt_no column, which lib/report.ts assigns — one model feeds the sheet
// and this zip alike, so they can't disagree.
//
// Pure, like the rest of lib/: blobs are passed in already fetched, this never
// touches IndexedDB.

export const ZIP_MIME = 'application/zip';

export interface ReceiptPhoto {
  receiptNo: number;
  blob: Blob;
}

export function zipFilename(tripName: string, now = new Date()): string {
  return `dts-receipts-${slugify(tripName)}-${now.toISOString().slice(0, 10)}.zip`;
}

function extensionFor(mimeType: string): string {
  return mimeType === PDF_MIME ? 'pdf' : 'jpg';
}

// Zero-padded to the widest number present, so filenames sort naturally in
// Finder/Explorer at the office (receipt-02 before receipt-10).
export function receiptFilename(
  receiptNo: number,
  total: number,
  mimeType: string,
): string {
  const width = Math.max(2, String(total).length);
  return `receipts/receipt-${String(receiptNo).padStart(width, '0')}.${extensionFor(mimeType)}`;
}

export async function buildReceiptZip(
  xlsxBuffer: ArrayBuffer,
  xlsxName: string,
  photos: ReceiptPhoto[],
): Promise<Blob> {
  // Dynamically imported, same convention as ExcelJS in xlsx.ts — keeps it out
  // of the statically-loaded bundle.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  // Wrapped in a Uint8Array rather than passed raw: JSZip type-detects with
  // `instanceof ArrayBuffer`, which fails for a buffer that crossed a realm
  // boundary (jsdom vs node in tests, and whatever ExcelJS hands back).
  zip.file(xlsxName, new Uint8Array(xlsxBuffer));
  const highest = photos.reduce((max, p) => Math.max(max, p.receiptNo), 0);
  for (const p of photos) {
    zip.file(receiptFilename(p.receiptNo, highest, p.blob.type), p.blob);
  }

  // STORE, not DEFLATE: xlsx is already a zip and a receipt (JPEG or PDF) is
  // already compressed, so deflating again costs CPU on a phone for ~nothing.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
