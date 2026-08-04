import { useEffect } from 'react';

interface Props {
  url: string;
  onClose: () => void;
}

// Full-screen view of one receipt photo. Opened from a list row's photo badge
// — the blob is only fetched at that point, so a long list never pays to
// decode every attached photo just to render.
export function PhotoLightbox({ url, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt photo"
      onClick={onClose}
    >
      <img
        className="lightbox__img"
        src={url}
        alt="Receipt"
        // The backdrop closes; tapping the photo itself should not, so a
        // mis-tap while zooming doesn't dismiss it.
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="btn lightbox__close"
        // The button sits inside the backdrop, whose click also closes —
        // without this the handler runs twice for one tap.
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close receipt photo"
      >
        Close
      </button>
    </div>
  );
}
