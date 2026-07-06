import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportView } from './ExportView';
import type { Expense } from '../types';
import { buildBackup } from '../lib/backup';

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
        onRestore={vi.fn()}
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
        onRestore={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /export & share \.xlsx/i }),
    ).toBeDisabled();
    expect(screen.getByText(/nothing to export yet/i)).toBeInTheDocument();
  });

  it('parses a chosen backup file and asks for confirmation before restoring', async () => {
    const onRestore = vi.fn();
    render(
      <ExportView
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onRestore={onRestore}
      />,
    );

    const json = buildBackup([exp()], [], {}, noAccounts);
    const file = new File([json], 'dts-backup-2026-07-01.json', {
      type: 'application/json',
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/1 expense/)).toBeInTheDocument(),
    );
    expect(onRestore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /replace all data/i }));
    expect(onRestore).toHaveBeenCalledWith({
      expenses: [exp()],
      segments: [],
      dtsExpected: {},
      dtsAccountExpected: noAccounts,
    });
  });

  it('shows an error and does not offer to restore an invalid file', async () => {
    const onRestore = vi.fn();
    render(
      <ExportView
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onRestore={onRestore}
      />,
    );

    const file = new File(['not json'], 'bad.json', {
      type: 'application/json',
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/not a valid json file/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /replace all data/i }),
    ).not.toBeInTheDocument();
  });
});
