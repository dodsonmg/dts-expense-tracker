import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportView } from './ExportView';
import type { Expense, TripBackup } from '../types';
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

const tripBackup = (over: Partial<TripBackup> = {}): TripBackup => ({
  id: 't1',
  name: 'London Aug 2026',
  createdAt: '2026-08-01',
  expenses: [exp()],
  segments: [],
  dtsExpected: {},
  dtsAccountExpected: noAccounts,
  ...over,
});

describe('ExportView', () => {
  it('offers .xlsx (primary) and CSV exports', () => {
    render(
      <ExportView
        tripName="London Aug 2026"
        expenses={[exp()]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onDownloadBackup={vi.fn()}
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
        tripName="London Aug 2026"
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onDownloadBackup={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /export & share \.xlsx/i }),
    ).toBeDisabled();
    expect(screen.getByText(/nothing to export yet/i)).toBeInTheDocument();
  });

  it('parses a chosen multi-trip backup and asks for confirmation before restoring', async () => {
    const onRestore = vi.fn();
    render(
      <ExportView
        tripName="London Aug 2026"
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onDownloadBackup={vi.fn()}
        onRestore={onRestore}
      />,
    );

    const trips = [tripBackup(), tripBackup({ id: 't2', name: 'Ramstein Sep 2026', expenses: [] })];
    const json = buildBackup(trips);
    const file = new File([json], 'dts-backup-2026-07-01.json', {
      type: 'application/json',
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/2 trips/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/London Aug 2026.*1 expenses/)).toBeInTheDocument();
    expect(screen.getByText(/Ramstein Sep 2026.*0 expenses/)).toBeInTheDocument();
    expect(onRestore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /replace all data/i }));
    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ trips }),
    );
  });

  it('shows an error and does not offer to restore an invalid file', async () => {
    const onRestore = vi.fn();
    render(
      <ExportView
        tripName="London Aug 2026"
        expenses={[]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onDownloadBackup={vi.fn()}
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

  it('downloads a backup by calling onDownloadBackup', async () => {
    const onDownloadBackup = vi.fn().mockResolvedValue(buildBackup([tripBackup()]));
    render(
      <ExportView
        tripName="London Aug 2026"
        expenses={[exp()]}
        segments={[]}
        expected={{}}
        accountExpected={noAccounts}
        onDownloadBackup={onDownloadBackup}
        onRestore={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /download backup/i }));
    await waitFor(() => expect(onDownloadBackup).toHaveBeenCalled());
  });
});
