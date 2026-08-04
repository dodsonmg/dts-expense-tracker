import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseList } from './ExpenseList';
import type { Expense } from '../types';
import { FOREIGN_SYMBOL } from '../lib/format';

const foreignLabelExact = new RegExp(`^${FOREIGN_SYMBOL}$`);

// The photo props most tests don't exercise. Tests that do override them.
const photoProps = {
  onAttachPhoto: vi.fn(),
  onRemovePhoto: vi.fn(),
  onLoadPhoto: vi.fn().mockResolvedValue(null),
};

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: null,
  amount_usd: 10,
  payment: 'GTCC',
  note: '',
  entered: false,
  miles: null,
  rate: null,
  photoIds: [],
  ...over,
});

describe('ExpenseList — entered-in-DTS', () => {
  it('marks an item entered via its toggle', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[exp({ id: 'a', entered: false })]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /mark as entered in dts/i }),
    );
    expect(onUpdate).toHaveBeenCalledWith('a', { entered: true });
  });

  it('unmarks an already-entered item', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[exp({ id: 'a', entered: true })]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /tap to unmark/i }));
    expect(onUpdate).toHaveBeenCalledWith('a', { entered: false });
  });

  it('toggling entered does not open the row editor', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[exp({ id: 'a' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /mark as entered in dts/i }),
    );
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('opens the editor when the row body is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[exp({ id: 'a', category: 'LODGING' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('"not entered only" filter hides entered items', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({ id: 'a', category: 'LODGING', entered: true }),
          exp({ id: 'b', category: 'TRANSPORT', entered: false }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('LODGING')).toBeInTheDocument();
    await user.click(
      screen.getByRole('checkbox', { name: /not entered in dts only/i }),
    );
    expect(screen.queryByText('LODGING')).toBeNull();
    expect(screen.getByText('TRANSPORT')).toBeInTheDocument();
  });

  it('combines with the USD-pending filter (intersection)', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          // pending + not entered  -> survives both filters
          exp({ id: 'a', note: 'aaa', amount_gbp: 5, amount_usd: null, entered: false }),
          // pending + entered      -> removed by "not entered only"
          exp({ id: 'b', note: 'bbb', amount_gbp: 5, amount_usd: null, entered: true }),
          // not pending + not entered -> removed by "usd pending only"
          exp({ id: 'c', note: 'ccc', amount_gbp: 5, amount_usd: 6, entered: false }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', { name: /usd pending only/i }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: /not entered in dts only/i }),
    );

    expect(screen.getByText('aaa')).toBeInTheDocument();
    expect(screen.queryByText('bbb')).toBeNull();
    expect(screen.queryByText('ccc')).toBeNull();
  });
});

describe('ExpenseList — MILEAGE calculator', () => {
  it('shows a miles/rate sub-line on a MILEAGE row', () => {
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({
            id: 'a',
            category: 'MILEAGE',
            amount_usd: 28.14,
            miles: 42,
            rate: 0.67,
            photoIds: [],
          }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('42.0 mi @ $0.670/mi')).toBeInTheDocument();
  });

  it('does not show a mileage sub-line on a non-MILEAGE row', () => {
    render(
      <ExpenseList
        {...photoProps}
        expenses={[exp({ id: 'a', category: 'LODGING' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText(/mi @/)).toBeNull();
  });

  it('EditRow shows the Miles/Rate calculator for a MILEAGE row and saves the recomputed amount', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({
            id: 'a',
            category: 'MILEAGE',
            amount_usd: 28.14,
            miles: 42,
            rate: 0.67,
            photoIds: [],
          }),
        ]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('MILEAGE'));
    expect(screen.queryByLabelText(foreignLabelExact)).toBeNull();

    const miles = screen.getByLabelText('Miles') as HTMLInputElement;
    await user.clear(miles);
    await user.type(miles, '10');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ miles: 10, rate: 0.67, amount_usd: 6.7 }),
    );
  });

  it('EditRow shows the plain foreign-currency/USD fields for a non-MILEAGE row', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[exp({ id: 'a', category: 'LODGING' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    expect(screen.getByLabelText(foreignLabelExact)).toBeInTheDocument();
    expect(screen.getByLabelText(/^USD$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Miles')).toBeNull();
  });

  it('EditRow shows the lodging tax reminder for a LODGING row, not other categories', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({ id: 'a', category: 'LODGING' }),
          exp({ id: 'b', category: 'TRANSPORT' }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    expect(screen.getByText(/separate rows/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByText('TRANSPORT'));
    expect(screen.queryByText(/separate rows/i)).toBeNull();
  });

  it('defaults to manual mode for a MILEAGE row with no miles set (legacy/manual entry)', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({ id: 'a', category: 'MILEAGE', amount_usd: 50, miles: null, rate: null }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('MILEAGE'));
    expect(screen.getByLabelText(foreignLabelExact)).toBeInTheDocument();
    expect(screen.queryByLabelText('Miles')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Use miles × rate calculator instead' }),
    ).toBeInTheDocument();
  });

  it('toggles between calculator and manual mode and saves accordingly', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({
            id: 'a',
            category: 'MILEAGE',
            amount_usd: 28.14,
            miles: 42,
            rate: 0.67,
            photoIds: [],
          }),
        ]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('MILEAGE'));
    await user.click(
      screen.getByRole('button', { name: 'Enter USD manually instead' }),
    );
    expect(screen.queryByLabelText('Miles')).toBeNull();

    const usd = screen.getByLabelText(/^USD$/i);
    await user.clear(usd);
    await user.type(usd, '99');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ amount_usd: 99, miles: null, rate: null }),
    );
  });
});

vi.mock('../lib/photo', () => ({
  compressImage: vi.fn(async (blob: Blob) => blob),
}));

describe('ExpenseList — receipt photos', () => {
  const pickFile = () =>
    new File(['receipt bytes'], 'receipt.jpg', { type: 'image/jpeg' });

  it('shows a view-photo badge only on rows that have one', () => {
    render(
      <ExpenseList
        {...photoProps}
        expenses={[
          exp({ id: 'a', category: 'LODGING', photoIds: ['p1'] }),
          exp({ id: 'b', category: 'TRANSPORT', photoIds: [] }),
        ]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /view receipt photo for LODGING/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /view receipt photo for TRANSPORT/i }),
    ).toBeNull();
  });

  it('opens the photo in a lightbox, fetching the blob only on tap', async () => {
    const user = userEvent.setup();
    const onLoadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob(['bytes'], { type: 'image/jpeg' }));
    render(
      <ExpenseList
        {...photoProps}
        onLoadPhoto={onLoadPhoto}
        expenses={[exp({ id: 'a', photoIds: ['p1'] })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Rendering the list must not decode any photo.
    expect(onLoadPhoto).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /view receipt photo/i }));

    expect(onLoadPhoto).toHaveBeenCalledWith('p1');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close receipt photo/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tapping the photo badge does not open the row editor', async () => {
    const user = userEvent.setup();
    const onLoadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob(['bytes'], { type: 'image/jpeg' }));
    render(
      <ExpenseList
        {...photoProps}
        onLoadPhoto={onLoadPhoto}
        expenses={[exp({ id: 'a', photoIds: ['p1'] })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /view receipt photo/i }));

    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
  });

  it('EditRow attaches a photo on Save, not on pick', async () => {
    const user = userEvent.setup();
    const onAttachPhoto = vi.fn();
    render(
      <ExpenseList
        {...photoProps}
        onAttachPhoto={onAttachPhoto}
        expenses={[exp({ id: 'a' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    await user.upload(screen.getByTestId('edit-a-photo-input'), pickFile());
    await screen.findByAltText('Attached receipt');

    // Staged like every other field in the row — nothing committed yet.
    expect(onAttachPhoto).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onAttachPhoto).toHaveBeenCalledWith('a', expect.any(Blob));
  });

  it('EditRow discards a staged photo on Cancel', async () => {
    const user = userEvent.setup();
    const onAttachPhoto = vi.fn();
    render(
      <ExpenseList
        {...photoProps}
        onAttachPhoto={onAttachPhoto}
        expenses={[exp({ id: 'a' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    await user.upload(screen.getByTestId('edit-a-photo-input'), pickFile());
    await screen.findByAltText('Attached receipt');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onAttachPhoto).not.toHaveBeenCalled();
  });

  it('EditRow removes an existing photo on Save', async () => {
    const user = userEvent.setup();
    const onRemovePhoto = vi.fn();
    const onLoadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob(['bytes'], { type: 'image/jpeg' }));
    render(
      <ExpenseList
        {...photoProps}
        onRemovePhoto={onRemovePhoto}
        onLoadPhoto={onLoadPhoto}
        expenses={[exp({ id: 'a', photoIds: ['p1'] })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    // The open row eagerly previews its existing photo (only one row is open
    // at a time, unlike the collapsed rows' badge-only treatment).
    await screen.findByAltText('Attached receipt');
    expect(onLoadPhoto).toHaveBeenCalledWith('p1');

    await user.click(screen.getByRole('button', { name: /remove photo/i }));
    expect(screen.queryByAltText('Attached receipt')).toBeNull();
    expect(onRemovePhoto).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onRemovePhoto).toHaveBeenCalledWith('a');
  });
});
