import { useRef, useState } from 'react';
import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { buildCsv, csvFilename } from '../lib/csv';
import { buildXlsx, xlsxFilename, XLSX_MIME } from '../lib/xlsx';
import {
  backupFilename,
  BackupParseError,
  buildBackup,
  parseBackup,
  type Backup,
} from '../lib/backup';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
  expected: DtsExpected;
  accountExpected: DtsAccountExpected;
  onRestore: (data: {
    expenses: Expense[];
    segments: MieSegment[];
    dtsExpected: DtsExpected;
    dtsAccountExpected: DtsAccountExpected;
  }) => void;
}

// Export to email to self. A formatted .xlsx (reconciliation tables at the top)
// is primary; a plain CSV is kept as a lightweight fallback. Sharing uses the
// Web Share API (iOS shows Mail) with a download fallback.
export function ExportView({
  expenses,
  segments,
  expected,
  accountExpected,
  onRestore,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Backup | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const empty = expenses.length === 0 && segments.length === 0;

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
    return { blob: new Blob([buf], { type: XLSX_MIME }), name: xlsxFilename() };
  }

  function makeCsv(): { blob: Blob; name: string } {
    const csv = buildCsv(expenses, segments, expected, accountExpected);
    return { blob: new Blob([csv], { type: 'text/csv' }), name: csvFilename() };
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

  function downloadBackupFile() {
    const json = buildBackup(expenses, segments, expected, accountExpected);
    downloadBlob(new Blob([json], { type: 'application/json' }), backupFilename());
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

  function commitRestore() {
    if (!pendingRestore) return;
    onRestore({
      expenses: pendingRestore.expenses,
      segments: pendingRestore.segments,
      dtsExpected: pendingRestore.dtsExpected,
      dtsAccountExpected: pendingRestore.dtsAccountExpected,
    });
    setPendingRestore(null);
    setStatus('Backup restored.');
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

      {busy && <p className="muted small">Building spreadsheet…</p>}
      {empty && <p className="muted">Nothing to export yet.</p>}
      {status && !busy && <p className="muted small">{status}</p>}

      <div className="card stack">
        <h2>Backup</h2>
        <p className="muted small">
          A full backup (all expenses, M&amp;IE segments, and DTS totals) as a
          single JSON file — for moving to a new device, not for the office.
          Restoring <strong>replaces</strong> everything currently on this
          device.
        </p>

        <button type="button" className="btn" onClick={downloadBackupFile}>
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
              This will <strong>replace</strong> everything on this device
              with the backup: {pendingRestore.expenses.length} expense
              {pendingRestore.expenses.length === 1 ? '' : 's'},{' '}
              {pendingRestore.segments.length} M&amp;IE segment
              {pendingRestore.segments.length === 1 ? '' : 's'}, and DTS
              totals
              {pendingRestore.exportedAt
                ? ` (backed up ${new Date(pendingRestore.exportedAt).toLocaleString()})`
                : ''}
              .
            </p>
            <button
              type="button"
              className="btn btn--danger"
              onClick={commitRestore}
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
