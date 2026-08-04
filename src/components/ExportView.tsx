import { useRef, useState } from 'react';
import type { DtsAccountExpected, DtsExpected, Expense, MieSegment } from '../types';
import type { LastBackupInfo } from '../db';
import { buildCsv, csvFilename } from '../lib/csv';
import { buildXlsx, xlsxFilename, XLSX_MIME } from '../lib/xlsx';
import { buildReport } from '../lib/report';
import { buildReceiptZip, zipFilename, ZIP_MIME, type ReceiptPhoto } from '../lib/zip';
import { backupFilename, BackupParseError, parseBackup, type Backup } from '../lib/backup';

interface Props {
  tripName: string;
  expenses: Expense[];
  segments: MieSegment[];
  expected: DtsExpected;
  accountExpected: DtsAccountExpected;
  onDownloadBackup: () => Promise<string>;
  onRestore: (backup: Backup) => void | Promise<void>;
  onLoadPhoto: (photoId: string) => Promise<Blob | null>;
  lastBackup: LastBackupInfo | null;
  onBackedUp: () => void;
}

function relativeDays(at: string): string {
  const days = Math.floor((Date.now() - Date.parse(at)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// Export to email to self. A formatted .xlsx (reconciliation tables at the top)
// is primary; a plain CSV is kept as a lightweight fallback. Sharing uses the
// Web Share API (iOS shows Mail) with a download fallback.
export function ExportView({
  tripName,
  expenses,
  segments,
  expected,
  accountExpected,
  onDownloadBackup,
  onRestore,
  onLoadPhoto,
  lastBackup,
  onBackedUp,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Backup | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const empty = expenses.length === 0 && segments.length === 0;
  const photoCount = expenses.filter((e) => e.photoIds.length > 0).length;

  async function shareBlob(blob: Blob, name: string, type: string) {
    const file = new File([blob], name, { type });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        setStatus('Shared.');
        return;
      } catch {
        // user cancelled or share failed — fall through to download
      }
    }
    downloadBlob(blob, name);
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${name}`);
  }

  async function makeXlsx(): Promise<{ blob: Blob; name: string }> {
    const buf = await buildXlsx(expenses, segments, expected, accountExpected);
    return {
      blob: new Blob([buf], { type: XLSX_MIME }),
      name: xlsxFilename(tripName),
    };
  }

  // The spreadsheet plus the photos it references. Both come from the same
  // buildReport model, so the Receipt # column and receipt-NN.jpg always agree.
  async function makeZip(): Promise<{ blob: Blob; name: string }> {
    const buf = await buildXlsx(expenses, segments, expected, accountExpected);
    const report = buildReport(expenses, segments, expected, accountExpected);

    // report.expenses is a 1:1 map over `expenses`, so indexes line up.
    const photos: ReceiptPhoto[] = [];
    for (let i = 0; i < expenses.length; i++) {
      const photoId = expenses[i].photoIds[0];
      const receiptNo = report.expenses[i].receiptNo;
      if (!photoId || receiptNo == null) continue;
      const blob = await onLoadPhoto(photoId);
      // A missing blob shouldn't sink the whole export — the sheet still has
      // the row, it just won't have evidence attached.
      if (blob) photos.push({ receiptNo, blob });
    }

    return {
      blob: await buildReceiptZip(buf, xlsxFilename(tripName), photos),
      name: zipFilename(tripName),
    };
  }

  function makeCsv(): { blob: Blob; name: string } {
    const csv = buildCsv(expenses, segments, expected, accountExpected);
    return { blob: new Blob([csv], { type: 'text/csv' }), name: csvFilename(tripName) };
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch {
      setStatus('Export failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadBackupFile() {
    const json = await onDownloadBackup();
    downloadBlob(new Blob([json], { type: 'application/json' }), backupFilename());
    onBackedUp();
  }

  async function handleBackupFile(file: File) {
    setRestoreError(null);
    setPendingRestore(null);
    try {
      const text = await file.text();
      setPendingRestore(parseBackup(text));
    } catch (err) {
      setRestoreError(
        err instanceof BackupParseError
          ? err.message
          : 'Could not read that file.',
      );
    }
  }

  async function commitRestore() {
    if (!pendingRestore) return;
    // Not setStatus('Backup restored.') here — restoring reloads the active
    // trip's data, which unmounts this view while it's loading, discarding
    // any local status set right before that. App.tsx owns that
    // confirmation instead, in a banner that survives the remount.
    await onRestore(pendingRestore);
    onBackedUp();
    setPendingRestore(null);
  }

  function cancelRestore() {
    setPendingRestore(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="stack">
      <p className="muted small">
        A formatted <strong>.xlsx</strong> with the reconciliation tables (by
        category and by account, mismatches highlighted) at the top and the raw
        rows behind them — the office reconciliation view. CSV is also available.
      </p>

      <button
        type="button"
        className="btn btn--primary btn--big"
        disabled={empty || busy}
        onClick={() =>
          withBusy(async () => {
            const { blob, name } = await makeXlsx();
            await shareBlob(blob, name, XLSX_MIME);
          })
        }
      >
        ⇪ Export &amp; share .xlsx
      </button>
      <button
        type="button"
        className="btn"
        disabled={empty || busy}
        onClick={() =>
          withBusy(async () => {
            const { blob, name } = await makeXlsx();
            downloadBlob(blob, name);
          })
        }
      >
        Download .xlsx
      </button>
      <button
        type="button"
        className="btn"
        disabled={empty || busy}
        onClick={() => {
          const { blob, name } = makeCsv();
          downloadBlob(blob, name);
        }}
      >
        Download CSV
      </button>

      {photoCount > 0 && (
        <>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                const { blob, name } = await makeZip();
                await shareBlob(blob, name, ZIP_MIME);
              })
            }
          >
            ⇪ Export &amp; share receipts (.zip)
          </button>
          <p className="muted small">
            The .xlsx plus {photoCount} receipt photo
            {photoCount === 1 ? '' : 's'}, numbered to match the sheet&apos;s{' '}
            <strong>Receipt #</strong> column — attach{' '}
            <code>receipt-01.jpg</code> to the line numbered 1 as you key it
            into DTS.
          </p>
        </>
      )}

      {busy && <p className="muted small">Building spreadsheet…</p>}
      {empty && <p className="muted">Nothing to export yet.</p>}
      {status && !busy && <p className="muted small">{status}</p>}

      <div className="card stack">
        <h2>Backup</h2>
        <p className="muted small">
          A full backup of <strong>every trip on this device</strong> (all
          expenses, M&amp;IE segments, and DTS totals) as a single JSON file —
          for moving to a new device, not for the office. Restoring{' '}
          <strong>replaces</strong> every trip currently on this device.
        </p>

        <p className="muted small">
          Last backup: {lastBackup ? relativeDays(lastBackup.at) : 'never'}
        </p>

        <button type="button" className="btn" onClick={() => void downloadBackupFile()}>
          Download backup (JSON)
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Restore from backup…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleBackupFile(file);
          }}
        />

        {restoreError && <p className="muted small">{restoreError}</p>}

        {pendingRestore && (
          <div className="card stack">
            <p>
              This will <strong>replace every trip on this device</strong> with
              the backup: {pendingRestore.trips.length} trip
              {pendingRestore.trips.length === 1 ? '' : 's'} —{' '}
              {pendingRestore.trips
                .map((t) => `"${t.name}" (${t.expenses.length} expenses)`)
                .join(', ')}
              {pendingRestore.exportedAt
                ? ` — backed up ${new Date(pendingRestore.exportedAt).toLocaleString()}`
                : ''}
              .
            </p>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void commitRestore()}
            >
              Replace all data
            </button>
            <button type="button" className="btn" onClick={cancelRestore}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
