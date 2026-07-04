import { useState } from 'react';
import { useTripData } from './useTripData';
import { EntryForm } from './components/EntryForm';
import { ExpenseList } from './components/ExpenseList';
import { MieView } from './components/MieView';
import { TotalsView } from './components/TotalsView';
import { ExportView } from './components/ExportView';

const TABS = [
  { id: 'entry', label: 'Entry', icon: '＋' },
  { id: 'list', label: 'List', icon: '☰' },
  { id: 'mie', label: 'M&IE', icon: '％' },
  { id: 'totals', label: 'Totals', icon: 'Σ' },
  { id: 'export', label: 'Export', icon: '⇪' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('entry');
  const trip = useTripData();

  return (
    <div className="app">
      <header className="app__header">
        <h1>DTS Expense Tracker</h1>
      </header>

      <main className="app__main">
        {!trip.loaded ? (
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
            onSetDts={trip.setDtsExpected}
          />
        ) : (
          <ExportView expenses={trip.expenses} segments={trip.segments} />
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
