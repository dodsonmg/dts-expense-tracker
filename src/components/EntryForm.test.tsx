import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryForm } from './EntryForm';

describe('EntryForm', () => {
  it('cannot save until a GBP or USD amount is entered', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    const save = screen.getByRole('button', { name: /save & add another/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/GBP/i), '80');
    expect(save).toBeEnabled();
  });

  it('submits parsed amounts and the chosen payment', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAdd={onAdd} onDone={vi.fn()} />);

    await user.type(screen.getByLabelText(/USD/i), '100.50');
    await user.click(screen.getByRole('button', { name: /^personal$/i }));
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_gbp: null,
        amount_usd: 100.5,
        payment: 'personal',
      }),
    );
  });

  it('clears amounts after saving for fast repeat entry', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    const gbp = screen.getByLabelText(/GBP/i) as HTMLInputElement;
    await user.type(gbp, '80');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(gbp.value).toBe('');
  });
});
