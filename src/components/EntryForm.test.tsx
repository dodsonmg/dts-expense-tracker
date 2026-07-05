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
        entered: false, // new expenses aren't in DTS yet
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

describe('EntryForm — MILEAGE calculator', () => {
  it('swaps the GBP/USD fields for Miles/Rate when MILEAGE is selected', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');

    expect(screen.queryByLabelText(/GBP/i)).toBeNull();
    expect(screen.queryByLabelText(/USD \(DTS\)/i)).toBeNull();
    expect(screen.getByLabelText('Miles')).toBeInTheDocument();
    expect(screen.getByLabelText(/Rate/i)).toBeInTheDocument();
  });

  it('computes and submits the USD amount from miles × rate', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAdd={onAdd} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');
    await user.type(screen.getByLabelText('Miles'), '42');
    await user.type(screen.getByLabelText(/Rate/i), '0.67');

    expect(screen.getByText('= $28.14')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'MILEAGE',
        amount_gbp: null,
        amount_usd: 28.14,
        miles: 42,
        rate: 0.67,
      }),
    );
  });

  it('persists the rate across saves but clears miles', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');
    const miles = screen.getByLabelText('Miles') as HTMLInputElement;
    const rate = screen.getByLabelText(/Rate/i) as HTMLInputElement;
    await user.type(miles, '42');
    await user.type(rate, '0.67');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(miles.value).toBe('');
    expect(rate.value).toBe('0.67');
  });

  it('restores the GBP/USD fields when switching away from MILEAGE', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAdd={vi.fn()} onDone={vi.fn()} />);

    const category = screen.getByLabelText('Category');
    await user.selectOptions(category, 'MILEAGE');
    await user.selectOptions(category, 'LODGING');

    expect(screen.queryByLabelText('Miles')).toBeNull();
    expect(screen.getByLabelText(/GBP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/USD \(DTS\)/i)).toBeInTheDocument();
  });
});
