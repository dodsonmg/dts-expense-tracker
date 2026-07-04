import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TotalsView } from './TotalsView';
import type {
  Category,
  Currency,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  date: '2026-07-01',
  category: 'LODGING',
  amount_gbp: null,
  amount_usd: null,
  payment: 'GTCC',
  note: '',
  entered: false,
  ...over,
});

// Stateful wrapper so DTS inputs behave like they do under the real hook.
function Harness({
  expenses = [],
  segments = [],
}: {
  expenses?: Expense[];
  segments?: MieSegment[];
}) {
  const [expected, setExpected] = useState<DtsExpected>({});
  const onSetDts = (c: Category, cur: Currency, v: number | null) => {
    const key = cur === 'GBP' ? 'gbp' : 'usd';
    setExpected((prev) => ({
      ...prev,
      [c]: { ...(prev[c] ?? { gbp: null, usd: null }), [key]: v },
    }));
  };
  return (
    <TotalsView
      expenses={expenses}
      segments={segments}
      expected={expected}
      onSetDts={onSetDts}
    />
  );
}

describe('TotalsView — DTS reconciliation', () => {
  it('flags a mismatch and clears it when the value matches', async () => {
    const user = userEvent.setup();
    render(<Harness expenses={[exp({ category: 'LODGING', amount_usd: 100 })]} />);

    const input = screen.getByLabelText('DTS USD total for LODGING');
    await user.type(input, '96');
    expect(screen.getByText('+$4.00')).toBeInTheDocument(); // app 100 − dts 96

    await user.clear(input);
    await user.type(input, '100');
    expect(screen.queryByText('+$4.00')).toBeNull();
    expect(screen.getByLabelText('matches DTS')).toBeInTheDocument();
  });

  it('checks GBP and USD independently for one category', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        expenses={[exp({ category: 'LODGING', amount_gbp: 80, amount_usd: 100 })]}
      />,
    );

    await user.type(screen.getByLabelText('DTS GBP total for LODGING'), '80');
    await user.type(screen.getByLabelText('DTS USD total for LODGING'), '90');

    expect(screen.getByLabelText('matches DTS')).toBeInTheDocument(); // GBP
    expect(screen.getByText('+$10.00')).toBeInTheDocument(); // USD app 100 − dts 90
  });

  it('calls the setter with category, currency and parsed value', async () => {
    const user = userEvent.setup();
    const onSetDts = vi.fn();
    render(
      <TotalsView
        expenses={[]}
        segments={[]}
        expected={{}}
        onSetDts={onSetDts}
      />,
    );

    await user.type(screen.getByLabelText('DTS USD total for LODGING'), '5');
    expect(onSetDts).toHaveBeenLastCalledWith('LODGING', 'USD', 5);
  });
});
