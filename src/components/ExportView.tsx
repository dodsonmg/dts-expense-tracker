import { useState } from 'react';
import type {
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { buildCsv, csvFilename } from '../lib/csv';
import { buildXlsx, xlsxFilename, XLSX_MIME } from '../lib/xlsx';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
  expected: DtsExpected;
  accountExpected: DtsAccountExpected;
}

// Export to email to self. A formatted .xlsx (reconciliation tables at the top)
// is primary; a plain CSV is kept as a lightweight fallback. Sharing uses the
// Web Share API (iOS shows Mail) with a download fallback.
export function ExportView({
  expenses,
  segments,
  expected,
  accountExpected,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    </div>
  );
}
