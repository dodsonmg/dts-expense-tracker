import { useRegisterSW } from '../lib/pwaRegister';

// registerType: 'autoUpdate' (vite.config.ts) lets a new service worker take
// over silently in the background, but a tab already open has no way to know
// — it keeps running the old JS until fully closed and relaunched. This
// surfaces that moment instead of leaving it invisible.
export function UpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (needRefresh) {
    return (
      <div className="update-toast">
        <span>Update available.</span>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </button>
        <button
          type="button"
          className="update-toast__dismiss"
          aria-label="Dismiss"
          onClick={() => setNeedRefresh(false)}
        >
          ✕
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="update-toast">
        <span>Ready to work offline.</span>
        <button
          type="button"
          className="update-toast__dismiss"
          aria-label="Dismiss"
          onClick={() => setOfflineReady(false)}
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}
