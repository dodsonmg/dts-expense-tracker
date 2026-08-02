import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupNudgeToast } from './BackupNudgeToast';

describe('BackupNudgeToast', () => {
  it('renders nothing when not visible', () => {
    render(
      <BackupNudgeToast
        visible={false}
        daysSinceBackup={30}
        onDismiss={vi.fn()}
        onGoToBackup={vi.fn()}
      />,
    );
    expect(screen.queryByText(/backup/i)).not.toBeInTheDocument();
  });

  it('shows the day count when visible', () => {
    render(
      <BackupNudgeToast
        visible
        daysSinceBackup={9.5}
        onDismiss={vi.fn()}
        onGoToBackup={vi.fn()}
      />,
    );
    expect(screen.getByText(/it's been 9 days since your last backup/i)).toBeInTheDocument();
  });

  it('shows a distinct message when never backed up (Infinity)', () => {
    render(
      <BackupNudgeToast
        visible
        daysSinceBackup={Infinity}
        onDismiss={vi.fn()}
        onGoToBackup={vi.fn()}
      />,
    );
    expect(screen.getByText(/never backed up/i)).toBeInTheDocument();
  });

  it('"Back up now" fires onGoToBackup', async () => {
    const user = userEvent.setup();
    const onGoToBackup = vi.fn();
    render(
      <BackupNudgeToast
        visible
        daysSinceBackup={10}
        onDismiss={vi.fn()}
        onGoToBackup={onGoToBackup}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(onGoToBackup).toHaveBeenCalled();
  });

  it('dismiss fires onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <BackupNudgeToast
        visible
        daysSinceBackup={10}
        onDismiss={onDismiss}
        onGoToBackup={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
