import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildReceiptZip, receiptFilename, zipFilename } from './zip';

const blob = (text: string) => new Blob([text], { type: 'image/jpeg' });
const xlsxBuf = () => new TextEncoder().encode('fake xlsx bytes').buffer;

describe('zipFilename', () => {
  it('folds in the slugified trip name and the date', () => {
    expect(zipFilename('London Aug 2026', new Date('2026-07-04T12:00:00Z'))).toBe(
      'dts-receipts-london-aug-2026-2026-07-04.zip',
    );
  });
});

describe('receiptFilename', () => {
  it('pads to at least two digits', () => {
    expect(receiptFilename(1, 3)).toBe('receipts/receipt-01.jpg');
    expect(receiptFilename(9, 9)).toBe('receipts/receipt-09.jpg');
  });

  it('widens padding so names sort naturally past 99', () => {
    // Without this, receipt-10 would sort before receipt-9 in Finder.
    expect(receiptFilename(9, 100)).toBe('receipts/receipt-009.jpg');
    expect(receiptFilename(100, 100)).toBe('receipts/receipt-100.jpg');
  });
});

describe('buildReceiptZip', () => {
  it('bundles the spreadsheet at the root with photos under receipts/', async () => {
    const zip = await buildReceiptZip(xlsxBuf(), 'dts-expenses-trip.xlsx', [
      { receiptNo: 1, blob: blob('photo one') },
      { receiptNo: 2, blob: blob('photo two') },
    ]);

    const read = await JSZip.loadAsync(await zip.arrayBuffer());
    // JSZip also emits an implicit `receipts/` directory entry; compare files.
    expect(
      Object.values(read.files)
        .filter((f) => !f.dir)
        .map((f) => f.name)
        .sort(),
    ).toEqual([
      'dts-expenses-trip.xlsx',
      'receipts/receipt-01.jpg',
      'receipts/receipt-02.jpg',
    ]);
    expect(await read.file('dts-expenses-trip.xlsx')!.async('string')).toBe(
      'fake xlsx bytes',
    );
    expect(await read.file('receipts/receipt-01.jpg')!.async('string')).toBe(
      'photo one',
    );
  });

  it('names files by receiptNo, not by position', async () => {
    // A row without a photo leaves a gap in the array but not in the numbering,
    // so the file must be named for the number printed on the sheet.
    const zip = await buildReceiptZip(xlsxBuf(), 'x.xlsx', [
      { receiptNo: 3, blob: blob('third') },
    ]);

    const read = await JSZip.loadAsync(await zip.arrayBuffer());
    expect(read.file('receipts/receipt-03.jpg')).not.toBeNull();
  });

  it('still produces a valid zip when there are no photos', async () => {
    const zip = await buildReceiptZip(xlsxBuf(), 'x.xlsx', []);
    const read = await JSZip.loadAsync(await zip.arrayBuffer());
    expect(Object.keys(read.files)).toEqual(['x.xlsx']);
  });
});
