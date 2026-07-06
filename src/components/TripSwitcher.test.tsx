import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripSwitcher } from './TripSwitcher';
import type { Trip } from '../types';

const trips: Trip[] = [
  { id: 'a', name: 'London Aug 2026', createdAt: '2026-08-01' },
  { id: 'b', name: 'Ramstein Sep 2026', createdAt: '2026-09-01' },
];

describe('TripSwitcher', () => {
  it('shows the active trip name on the toggle, closed by default', () => {
    render(
      <TripSwitcher
        trips={trips}
        activeTripId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Trip: London Aug 2026/)).toBeInTheDocument();
    expect(screen.queryByText('Ramstein Sep 2026')).not.toBeInTheDocument();
  });

  it('opens the panel and lists every trip', async () => {
    const user = userEvent.setup();
    render(
      <TripSwitcher
        trips={trips}
        activeTripId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Trip: London/ }));
    expect(screen.getByRole('button', { name: 'Ramstein Sep 2026' })).toBeInTheDocument();
  });

  it('selecting a non-active trip calls onSelect and closes the panel', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TripSwitcher
        trips={trips}
        activeTripId="a"
        onSelect={onSelect}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Trip: London/ }));
    await user.click(screen.getByRole('button', { name: 'Ramstein Sep 2026' }));
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('button', { name: 'Ramstein Sep 2026' })).not.toBeInTheDocument();
  });

  it('renames a trip', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <TripSwitcher
        trips={trips}
        activeTripId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Trip: London/ }));
    await user.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    const input = screen.getByDisplayValue('London Aug 2026');
    await user.clear(input);
    await user.type(input, 'London (renamed)');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onRename).toHaveBeenCalledWith('a', 'London (renamed)');
  });

  it('creates a new trip', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => 'new-id');
    render(
      <TripSwitcher
        trips={trips}
        activeTripId="a"
        onSelect={vi.fn()}
        onCreate={onCreate}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Trip: London/ }));
    await user.click(screen.getByRole('button', { name: '＋ New trip' }));
    await user.type(screen.getByPlaceholderText('Trip name'), 'Stuttgart Oct 2026');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith('Stuttgart Oct 2026');
  });

  it('deletes a trip only after confirming', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TripSwitcher
        trips={trips}
        activeTripId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Trip: London/ }));
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('disables delete when only one trip remains', async () => {
    const user = userEvent.setup();
    render(
      <TripSwitcher
        trips={[trips[0]]}
        activeTripId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Trip: London/ }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
