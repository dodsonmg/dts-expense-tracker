interface Props {
  visible: boolean;
  daysSinceBackup: number;
  onDismiss: () => void;
  onGoToBackup: () => void;
}

// Modeled directly on UpdateToast: same .update-toast styling, mounted right
// below it in App.tsx so it's visible across every tab.
export function BackupNudgeToast({ visible, daysSinceBackup, onDismiss, onGoToBackup }: Props) {
  if (!visible) return null;

  const message = Number.isFinite(daysSinceBackup)
    ? `It's been ${Math.floor(daysSinceBackup)} days since your last backup.`
    : "You've never backed up this device's data.";

  return (
    <div className="update-toast">
      <span>{message}</span>
      <button type="button" className="btn btn--primary" onClick={onGoToBackup}>
        Back up now
      </button>
      <button
        type="button"
        className="update-toast__dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}
