import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateToast } from './UpdateToast';

const updateServiceWorker = vi.fn();
let needRefresh = false;
let offlineReady = false;
const setNeedRefresh = vi.fn((v: boolean) => {
  needRefresh = v;
});
const setOfflineReady = vi.fn((v: boolean) => {
  offlineReady = v;
});

// Mock the ../lib/pwaRegister indirection (a real, resolvable file), not the
// literal 'virtual:pwa-register/react' specifier directly — vitest.config.ts
// doesn't run the VitePWA plugin, so Vite can't resolve that specifier at all
// during tests, even when vi.mock targets it by name.
vi.mock('../lib/pwaRegister', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  }),
}));

describe('UpdateToast', () => {
  beforeEach(() => {
    needRefresh = false;
    offlineReady = false;
    vi.clearAllMocks();
  });

  it('renders nothing by default', () => {
    render(<UpdateToast />);
    expect(screen.queryByText(/Update available/)).toBeNull();
    expect(screen.queryByText(/Ready to work offline/)).toBeNull();
  });

  it('shows the update toast and reloads on click', async () => {
    needRefresh = true;
    const user = userEvent.setup();
    render(<UpdateToast />);

    expect(screen.getByText('Update available.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses the update toast', async () => {
    needRefresh = true;
    const user = userEvent.setup();
    render(<UpdateToast />);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('shows the offline-ready toast when not showing the update toast', () => {
    offlineReady = true;
    render(<UpdateToast />);
    expect(screen.getByText('Ready to work offline.')).toBeInTheDocument();
  });

  it('dismisses the offline-ready toast', async () => {
    offlineReady = true;
    const user = userEvent.setup();
    render(<UpdateToast />);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });
});
