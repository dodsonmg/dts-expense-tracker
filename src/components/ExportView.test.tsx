import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportView } from './ExportView';
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

const noAccounts = { gtcc: null, personal: null };

describe('ExportView', () => {
  it('offers .xlsx (primary) and CSV exports', () => {
    render(
      <ExportView
        expenses={[exp()]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
      />,
    );
    expect(
      screen.getByRole('button', { name: /export & share \.xlsx/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /download \.xlsx/i }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: /download csv/i })).toBeEnabled();
  });

  it('disables export when there is nothing to export', () => {
    render(
      <ExportView
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
      />,
    );
    expect(
      screen.getByRole('button', { name: /export & share \.xlsx/i }),
    ).toBeDisabled();
    expect(screen.getByText(/nothing to export yet/i)).toBeInTheDocument();
  });
});
