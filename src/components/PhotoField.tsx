import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../lib/photo';

interface Props {
  // Object URL of the currently attached photo, or null if there is none.
  // Owned by the caller, since where the blob lives differs: EntryForm holds
  // one pending in local state, EditRow reads a persisted one back from
  // storage.
  previewUrl: string | null;
  onSelect: (blob: Blob) => void;
  onRemove: () => void;
  // Distinguishes the file inputs when both forms are on screen, and gives
  // tests a stable handle.
  idPrefix: string;
}

// The receipt photo picker shared by EntryForm and EditRow. Compression
// happens here so neither caller has to think about it.
//
// Deliberately no `capture` attribute on the input: with plain accept="image/*"
// iOS offers its native sheet with both Take Photo and Photo Library, whereas
// `capture` forces the camera and blocks attaching a receipt photographed
// earlier.
export function PhotoField({ previewUrl, onSelect, onRemove, idPrefix }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const blob = await compressImage(file);
      if (alive.current) onSelect(blob);
    } catch {
      if (alive.current) setError('Could not read that image.');
    } finally {
      if (alive.current) setBusy(false);
      // Clear so picking the same file twice in a row still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="field">
      <span>Receipt photo</span>

      {previewUrl && (
        <img
          className="photo-thumb"
          src={previewUrl}
          alt="Attached receipt"
        />
      )}

      <div className="photo-actions">
        <button
          type="button"
          className="btn btn--small"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? 'Replace photo' : 'Add photo'}
        </button>
        {previewUrl && (
          <button
            type="button"
            className="btn btn--small"
            disabled={busy}
            onClick={onRemove}
          >
            Remove photo
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        id={`${idPrefix}-photo`}
        data-testid={`${idPrefix}-photo-input`}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {busy && <p className="muted small">Processing photo…</p>}
      {error && <p className="muted small">{error}</p>}
      {!previewUrl && !busy && !error && (
        <p className="muted small">
          Optional. Stays on this device — photos are not included in the
          backup file.
        </p>
      )}
    </div>
  );
}
