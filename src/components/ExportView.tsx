import { useState } from 'react';
import type { Expense, MieSegment } from '../types';
import { buildCsv, csvFilename } from '../lib/csv';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
}

// One tap → CSV to email to self. Uses the Web Share API (iOS shows Mail) when
// available, and always offers a plain download as a fallback.
export function ExportView({ expenses, segments }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  const empty = expenses.length === 0 && segments.length === 0;

  function makeFile(): { blob: Blob; name: string } {
    const csv = buildCsv(expenses, segments);
    return {
      blob: new Blob([csv], { type: 'text/csv' }),
      name: csvFilename(),
    };
  }

  async function share() {
    const { blob, name } = makeFile();
    const file = new File([blob], name, { type: 'text/csv' });
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
    download();
  }

  function download() {
    const { blob, name } = makeFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${name}`);
  }

  return (
    <div className="stack">
      <p className="muted small">
        Exports raw rows plus a totals block (by category and by account,
        GBP/USD kept separate) as a single CSV to email to yourself.
      </p>

      <button
        type="button"
        className="btn btn--primary btn--big"
        disabled={empty}
        onClick={share}
      >
        ⇪ Export &amp; share CSV
      </button>
      <button
        type="button"
        className="btn"
        disabled={empty}
        onClick={download}
      >
        Download CSV
      </button>

      {empty && <p className="muted">Nothing to export yet.</p>}
      {status && <p className="muted small">{status}</p>}
    </div>
  );
}
