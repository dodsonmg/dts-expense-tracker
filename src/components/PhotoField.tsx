import { useEffect, useRef, useState } from 'react';
import {
  prepareAttachment,
  isImageAttachment,
  ATTACHMENT_ACCEPT,
  AttachmentTooLargeError,
} from '../lib/photo';

interface Preview {
  // Object URL of the currently attached receipt.
  url: string;
  // The blob's MIME type — picks the <img> vs. file-chip rendering below.
  type: string;
}

interface Props {
  // Owned by the caller, since where the blob lives differs: EntryForm holds
  // one pending in local state, EditRow reads a persisted one back from
  // storage.
  preview: Preview | null;
  onSelect: (blob: Blob) => void;
  onRemove: () => void;
  // Distinguishes the file inputs when both forms are on screen, and gives
  // tests a stable handle.
  idPrefix: string;
  slot: 1 | 2;
  disabled?: boolean;
}

// The receipt attachment picker shared by EntryForm and EditRow. Photo
// compression / PDF size-checking happens here so neither caller has to
// think about it.
//
// Deliberately no `capture` attribute on the input: with plain
// accept="image/*,application/pdf" iOS offers its native sheet with both
// Take Photo and Photo Library (plus Files for a PDF), whereas `capture`
// forces the camera and blocks attaching a receipt photographed earlier.
export function PhotoField({
  preview,
  onSelect,
  onRemove,
  idPrefix,
  slot,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const canPasteImage =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function handleFile(file: File) {
    await handleAttachment(file);
  }

  async function handleAttachment(file: Blob) {
    setError(null);
    setBusy(true);
    try {
      const blob = await prepareAttachment(file);
      if (alive.current) onSelect(blob);
    } catch (err) {
      if (alive.current) {
        setError(
          err instanceof AttachmentTooLargeError
            ? 'That PDF is larger than 10 MB — pick a smaller file.'
            : 'Could not read that file.',
        );
      }
    } finally {
      if (alive.current) setBusy(false);
      // Clear so picking the same file twice in a row still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handlePaste() {
    setError(null);
    setBusy(true);
    try {
      const items = await navigator.clipboard.read();
      let image: Blob | null = null;
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          image = await item.getType(imageType);
          break;
        }
      }

      if (!image) {
        if (alive.current) {
          setError('No image found. Copy a screenshot or image, then try again.');
        }
        return;
      }

      const blob = await prepareAttachment(image);
      if (alive.current) onSelect(blob);
    } catch (err) {
      if (alive.current) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Clipboard access was denied. Allow Paste access and try again.'
            : 'Could not paste from the clipboard.',
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="field">
      <span>
        {slot === 1 ? 'Receipt' : 'Additional receipt or card evidence'}
      </span>

      {preview && (
        isImageAttachment(preview.type) ? (
          <img
            className="photo-thumb"
            src={preview.url}
            alt="Attached receipt"
          />
        ) : (
          <div className="photo-thumb photo-thumb--file">
            <span aria-hidden>📄</span>
            <span>Attached receipt: PDF</span>
          </div>
        )
      )}

      <div className="photo-actions">
        <button
          type="button"
          className="btn btn--small"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
        >
          {preview
            ? 'Replace photo'
            : slot === 1
              ? 'Add photo'
              : 'Add second attachment'}
        </button>
        {canPasteImage && (
          <button
            type="button"
            className="btn btn--small"
            disabled={busy || disabled}
            onClick={() => void handlePaste()}
          >
            Paste screenshot
          </button>
        )}
        {preview && (
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
        id={`${idPrefix}-photo${slot === 2 ? '-2' : ''}`}
        data-testid={`${idPrefix}-photo-input${slot === 2 ? '-2' : ''}`}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        disabled={busy || disabled}
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {busy && <p className="muted small">Processing photo…</p>}
      {error && <p className="muted small">{error}</p>}
      {slot === 1 && !preview && !busy && !error && (
        <p className="muted small">
          Optional. Stays on this device — photos and PDFs aren&apos;t in the
          backup file, but they do go in the receipts .zip export.
        </p>
      )}
    </div>
  );
}
