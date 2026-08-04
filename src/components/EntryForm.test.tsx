import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryForm } from './EntryForm';
import { FOREIGN_SYMBOL } from '../lib/format';

const foreignLabel = new RegExp(FOREIGN_SYMBOL);

describe('EntryForm', () => {
  it('cannot save until a foreign-currency or USD amount is entered', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    const save = screen.getByRole('button', { name: /save & add another/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(foreignLabel), '80');
    expect(save).toBeEnabled();
  });

  it('submits parsed amounts and the chosen payment', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={onAdd} onDone={vi.fn()} />);

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
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    const gbp = screen.getByLabelText(foreignLabel) as HTMLInputElement;
    await user.type(gbp, '80');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(gbp.value).toBe('');
  });
});

describe('EntryForm — MILEAGE calculator', () => {
  it('swaps the foreign-currency/USD fields for Miles/Rate when MILEAGE is selected', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');

    expect(screen.queryByLabelText(foreignLabel)).toBeNull();
    expect(screen.queryByLabelText(/USD \(DTS\)/i)).toBeNull();
    expect(screen.getByLabelText('Miles')).toBeInTheDocument();
    expect(screen.getByLabelText(/Rate/i)).toBeInTheDocument();
  });

  it('computes and submits the USD amount from miles × rate', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={onAdd} onDone={vi.fn()} />);

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
        photoIds: [],
      }),
    );
  });

  it('persists the rate across saves but clears miles', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');
    const miles = screen.getByLabelText('Miles') as HTMLInputElement;
    const rate = screen.getByLabelText(/Rate/i) as HTMLInputElement;
    await user.type(miles, '42');
    await user.type(rate, '0.67');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(miles.value).toBe('');
    expect(rate.value).toBe('0.67');
  });

  it('restores the foreign-currency/USD fields when switching away from MILEAGE', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    const category = screen.getByLabelText('Category');
    await user.selectOptions(category, 'MILEAGE');
    await user.selectOptions(category, 'LODGING');

    expect(screen.queryByLabelText('Miles')).toBeNull();
    expect(screen.getByLabelText(foreignLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(/USD \(DTS\)/i)).toBeInTheDocument();
  });

  it('offers a manual-entry toggle that switches back to plain foreign-currency/USD fields', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');
    await user.click(
      screen.getByRole('button', { name: 'Enter USD manually instead' }),
    );

    expect(screen.queryByLabelText('Miles')).toBeNull();
    expect(screen.getByLabelText(foreignLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(/USD \(DTS\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use miles × rate calculator instead' }),
    ).toBeInTheDocument();
  });

  it('submits typed foreign-currency/USD with null miles/rate in manual mode', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={onAdd} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'MILEAGE');
    await user.click(
      screen.getByRole('button', { name: 'Enter USD manually instead' }),
    );
    await user.type(screen.getByLabelText(/USD \(DTS\)/i), '50');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'MILEAGE',
        amount_gbp: null,
        amount_usd: 50,
        miles: null,
        rate: null,
        photoIds: [],
      }),
    );
  });
});

describe('EntryForm — LODGING tax reminder', () => {
  it('shows the tax-splitting reminder when LODGING is selected (the default)', () => {
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    expect(screen.getByText(/separate rows/i)).toBeInTheDocument();
  });

  it('hides the reminder for other categories', async () => {
    const user = userEvent.setup();
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'TRANSPORT');

    expect(screen.queryByText(/separate rows/i)).toBeNull();
  });
});

// compressImage draws to a canvas, which jsdom does not implement — mocked so
// these tests cover the wiring (pick -> preview -> attach with the right id)
// rather than the encoding, which is verified in a real browser.
vi.mock('../lib/photo', () => ({
  compressImage: vi.fn(async (blob: Blob) => blob),
}));

describe('EntryForm — receipt photo', () => {
  const pickFile = () =>
    new File(['receipt bytes'], 'receipt.jpg', { type: 'image/jpeg' });

  it('attaches a picked photo to the id onAdd returns', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockReturnValue('new-id');
    const onAttachPhoto = vi.fn();
    render(
      <EntryForm onAttachPhoto={onAttachPhoto} onAdd={onAdd} onDone={vi.fn()} />,
    );

    await user.upload(screen.getByTestId('entry-photo-input'), pickFile());
    await screen.findByAltText('Attached receipt');

    await user.type(screen.getByLabelText(/USD/i), '20');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAttachPhoto).toHaveBeenCalledTimes(1);
    expect(onAttachPhoto).toHaveBeenCalledWith('new-id', expect.any(Blob));
  });

  it('does not attach anything when no photo was picked', async () => {
    const user = userEvent.setup();
    const onAttachPhoto = vi.fn();
    render(
      <EntryForm
        onAttachPhoto={onAttachPhoto}
        onAdd={vi.fn().mockReturnValue('new-id')}
        onDone={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/USD/i), '20');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(onAttachPhoto).not.toHaveBeenCalled();
  });

  it('clears the staged photo after saving, so it does not repeat onto the next row', async () => {
    const user = userEvent.setup();
    const onAttachPhoto = vi.fn();
    render(
      <EntryForm
        onAttachPhoto={onAttachPhoto}
        onAdd={vi.fn().mockReturnValue('new-id')}
        onDone={vi.fn()}
      />,
    );

    await user.upload(screen.getByTestId('entry-photo-input'), pickFile());
    await screen.findByAltText('Attached receipt');

    await user.type(screen.getByLabelText(/USD/i), '20');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));

    expect(screen.queryByAltText('Attached receipt')).toBeNull();

    // A second save with no new photo must not re-attach the first one.
    await user.type(screen.getByLabelText(/USD/i), '30');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));
    expect(onAttachPhoto).toHaveBeenCalledTimes(1);
  });

  it('removes a staged photo before saving', async () => {
    const user = userEvent.setup();
    const onAttachPhoto = vi.fn();
    render(
      <EntryForm
        onAttachPhoto={onAttachPhoto}
        onAdd={vi.fn().mockReturnValue('new-id')}
        onDone={vi.fn()}
      />,
    );

    await user.upload(screen.getByTestId('entry-photo-input'), pickFile());
    await screen.findByAltText('Attached receipt');
    await user.click(screen.getByRole('button', { name: /remove photo/i }));

    expect(screen.queryByAltText('Attached receipt')).toBeNull();

    await user.type(screen.getByLabelText(/USD/i), '20');
    await user.click(screen.getByRole('button', { name: /save & add another/i }));
    expect(onAttachPhoto).not.toHaveBeenCalled();
  });

  it('offers the photo library as well as the camera', () => {
    render(<EntryForm onAttachPhoto={vi.fn()} onAdd={vi.fn()} onDone={vi.fn()} />);

    const input = screen.getByTestId('entry-photo-input');
    expect(input).toHaveAttribute('accept', 'image/*');
    // No `capture` attribute: it would force the camera and block attaching a
    // receipt photographed earlier.
    expect(input).not.toHaveAttribute('capture');
  });
});
