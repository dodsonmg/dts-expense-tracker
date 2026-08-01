import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TotalsView } from './TotalsView';
import type {
  Account,
  Category,
  DtsAccountExpected,
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
  miles: null,
  rate: null,
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
  const [accountExpected, setAccountExpected] = useState<DtsAccountExpected>({
    gtcc: null,
    personal: null,
  });
  return (
    <TotalsView
      expenses={expenses}
      segments={segments}
      expected={expected}
      accountExpected={accountExpected}
      onSetDts={(c: Category, v) => setExpected((p) => ({ ...p, [c]: v }))}
      onSetAccountDts={(a: Account, v) =>
        setAccountExpected((p) => ({ ...p, [a]: v }))
      }
    />
  );
}

describe('TotalsView — DTS reconciliation', () => {
  it('flags a category mismatch and clears it when the value matches', async () => {
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

  it('reconciles the GTCC/Personal reimbursement independently', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        expenses={[
          exp({ category: 'LODGING', payment: 'GTCC', amount_usd: 500 }),
          exp({ category: 'TRANSPORT', payment: 'personal', amount_usd: 200 }),
        ]}
      />,
    );

    await user.type(
      screen.getByLabelText('DTS USD reimbursement for GTCC'),
      '480',
    );
    await user.type(
      screen.getByLabelText('DTS USD reimbursement for Personal'),
      '200',
    );

    expect(screen.getByText('+$20.00')).toBeInTheDocument(); // GTCC 500 − 480
    expect(screen.getByLabelText('matches DTS')).toBeInTheDocument(); // Personal
  });

  it('calls the setters with the parsed value', async () => {
    const user = userEvent.setup();
    const onSetDts = vi.fn();
    const onSetAccountDts = vi.fn();
    render(
      <TotalsView
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={{ gtcc: null, personal: null }}
        onSetDts={onSetDts}
        onSetAccountDts={onSetAccountDts}
      />,
    );

    await user.type(screen.getByLabelText('DTS USD total for LODGING'), '5');
    expect(onSetDts).toHaveBeenLastCalledWith('LODGING', 5);

    await user.type(
      screen.getByLabelText('DTS USD reimbursement for GTCC'),
      '7',
    );
    expect(onSetAccountDts).toHaveBeenLastCalledWith('gtcc', 7);
  });
});

describe('TotalsView — USD-incomplete warning', () => {
  it('flags a category and account row fed by a USD-pending expense', () => {
    render(
      <Harness
        expenses={[
          exp({
            category: 'LODGING',
            payment: 'GTCC',
            amount_gbp: 80,
            amount_usd: null,
          }),
        ]}
      />,
    );

    expect(screen.getAllByText('1 missing USD')).toHaveLength(3); // LODGING + Total + GTCC rows
    expect(screen.getAllByText('1 row with missing USD')).toHaveLength(2); // per-section summary

  });

  it('does not flag rows once USD is filled in', () => {
    render(
      <Harness
        expenses={[
          exp({ category: 'LODGING', amount_gbp: 80, amount_usd: 100 }),
        ]}
      />,
    );
    expect(screen.queryByText(/missing USD/)).toBeNull();
  });
});

describe('TotalsView — all-expenses subtotal', () => {
  it('shows a Total row above GTCC/Personal, summing both accounts in USD', () => {
    render(
      <Harness
        expenses={[
          exp({ category: 'LODGING', payment: 'GTCC', amount_usd: 500 }),
          exp({ category: 'TRANSPORT', payment: 'personal', amount_usd: 200 }),
        ]}
      />,
    );

    const rows = screen.getAllByText(/^(Total|GTCC|Personal)$/);
    expect(rows.map((r) => r.textContent)).toEqual(['Total', 'GTCC', 'Personal']);
    expect(screen.getByText('$700.00')).toBeInTheDocument(); // 500 + 200
  });

  it('has no DTS input tied to the Total row', () => {
    render(<Harness expenses={[]} />);

    expect(
      screen.queryByLabelText(/DTS USD (total|reimbursement) for Total/i),
    ).toBeNull();
    // Only the two real DTS inputs on this screen (category + account each
    // have their own sections); the Total row contributes none.
    expect(screen.getByLabelText('DTS USD reimbursement for GTCC')).toBeInTheDocument();
    expect(screen.getByLabelText('DTS USD reimbursement for Personal')).toBeInTheDocument();
  });

  it('carries the incomplete tag when either account has USD-pending expenses', () => {
    render(
      <Harness
        expenses={[
          exp({
            category: 'LODGING',
            payment: 'GTCC',
            amount_gbp: 80,
            amount_usd: null,
          }),
        ]}
      />,
    );

    const totalRow = screen.getByText('Total').closest('.recon__row');
    expect(totalRow).not.toBeNull();
    expect(within(totalRow as HTMLElement).getByText('1 missing USD')).toBeInTheDocument();
  });
});
