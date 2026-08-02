import { useEffect, useState } from 'react';
import { useTrips } from './useTrips';
import { useTripData } from './useTripData';
import { useAllTripsData } from './useAllTripsData';
import { useBackupNudge } from './useBackupNudge';
import { EntryForm } from './components/EntryForm';
import { ExpenseList } from './components/ExpenseList';
import { MieView } from './components/MieView';
import { TotalsView } from './components/TotalsView';
import { ExportView } from './components/ExportView';
import { UpdateToast } from './components/UpdateToast';
import { BackupNudgeToast } from './components/BackupNudgeToast';
import { HelpView } from './components/HelpView';
import { TripSwitcher } from './components/TripSwitcher';
import { buildBackup, type Backup } from './lib/backup';

const TABS = [
  { id: 'entry', label: 'Entry', icon: '＋' },
  { id: 'list', label: 'List', icon: '☰' },
  { id: 'mie', label: 'M&IE', icon: '％' },
  { id: 'totals', label: 'Totals', icon: 'Σ' },
  { id: 'export', label: 'Export', icon: '⇪' },
  { id: 'help', label: 'Help', icon: '?' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('entry');
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const trips = useTrips();
  const trip = useTripData(trips.activeTripId, trips.reloadEpoch);
  const {
    loaded: allTripsLoaded,
    expensesByTripId,
    setExpensesForTrip,
  } = useAllTripsData(trips.trips);
  const backupNudge = useBackupNudge(expensesByTripId, allTripsLoaded);
  const ready = trips.loaded && trip.loaded;
  const activeTrip = trips.trips.find((t) => t.id === trips.activeTripId);

  // The one place expenses can change without the trip-id set changing —
  // keeps the backup nudge's edit count in sync with live edits to the
  // active trip without an extra IndexedDB read.
  useEffect(() => {
    if (trip.loaded) {
      setExpensesForTrip(trips.activeTripId, trip.expenses);
    }
  }, [trip.expenses, trip.loaded, trips.activeTripId, setExpensesForTrip]);

  // A restore reloads the active trip's data, which briefly unmounts
  // ExportView while it loads — so the confirmation lives here instead,
  // where it survives that remount.
  async function handleRestore(backup: Backup) {
    await trips.restoreFromBackup(backup);
    setRestoreMessage('Backup restored.');
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>DTS Expense Tracker</h1>
        {trips.loaded && (
          <TripSwitcher
            trips={trips.trips}
            activeTripId={trips.activeTripId}
            onSelect={trips.selectTrip}
            onCreate={trips.createTrip}
            onRename={trips.renameTrip}
            onDelete={trips.deleteTrip}
            onSetArchived={trips.setArchived}
          />
        )}
      </header>

      <UpdateToast />
      <BackupNudgeToast
        visible={backupNudge.shouldNudge}
        daysSinceBackup={backupNudge.daysSinceBackup}
        onDismiss={backupNudge.dismiss}
        onGoToBackup={() => setTab('export')}
      />

      {restoreMessage && (
        <div className="update-toast">
          <span>{restoreMessage}</span>
          <button
            type="button"
            className="update-toast__dismiss"
            aria-label="Dismiss"
            onClick={() => setRestoreMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      <main className="app__main">
        {!ready ? (
          <p className="muted">Loading…</p>
        ) : tab === 'entry' ? (
          <EntryForm onAdd={trip.addExpense} onDone={() => setTab('list')} />
        ) : tab === 'list' ? (
          <ExpenseList
            expenses={trip.expenses}
            onUpdate={trip.updateExpense}
            onDelete={trip.deleteExpense}
          />
        ) : tab === 'mie' ? (
          <MieView
            segments={trip.segments}
            onAdd={trip.addSegment}
            onUpdate={trip.updateSegment}
            onDelete={trip.deleteSegment}
          />
        ) : tab === 'totals' ? (
          <TotalsView
            expenses={trip.expenses}
            segments={trip.segments}
            expected={trip.dtsExpected}
            accountExpected={trip.dtsAccountExpected}
            onSetDts={trip.setDtsExpected}
            onSetAccountDts={trip.setDtsAccountExpected}
          />
        ) : tab === 'export' ? (
          <ExportView
            tripName={activeTrip?.name ?? ''}
            expenses={trip.expenses}
            segments={trip.segments}
            expected={trip.dtsExpected}
            accountExpected={trip.dtsAccountExpected}
            onDownloadBackup={async () => buildBackup(await trips.loadAllTripsData())}
            onRestore={handleRestore}
            lastBackup={backupNudge.lastBackup}
            onBackedUp={backupNudge.markBackedUp}
          />
        ) : (
          <HelpView />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabbar__btn${tab === t.id ? ' tabbar__btn--active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
          >
            <span className="tabbar__icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
