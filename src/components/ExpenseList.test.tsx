import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseList } from './ExpenseList';
import type { Expense } from '../types';

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
  ...over,
});

describe('ExpenseList — entered-in-DTS', () => {
  it('marks an item entered via its toggle', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <ExpenseList
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
        expenses={[
          exp({
            id: 'a',
            category: 'MILEAGE',
            amount_usd: 28.14,
            miles: 42,
            rate: 0.67,
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
        expenses={[
          exp({
            id: 'a',
            category: 'MILEAGE',
            amount_usd: 28.14,
            miles: 42,
            rate: 0.67,
          }),
        ]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('MILEAGE'));
    expect(screen.queryByLabelText(/^GBP$/i)).toBeNull();

    const miles = screen.getByLabelText('Miles') as HTMLInputElement;
    await user.clear(miles);
    await user.type(miles, '10');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ miles: 10, rate: 0.67, amount_usd: 6.7 }),
    );
  });

  it('EditRow shows the plain GBP/USD fields for a non-MILEAGE row', async () => {
    const user = userEvent.setup();
    render(
      <ExpenseList
        expenses={[exp({ id: 'a', category: 'LODGING' })]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText('LODGING'));
    expect(screen.getByLabelText(/^GBP$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^USD$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Miles')).toBeNull();
  });
});
