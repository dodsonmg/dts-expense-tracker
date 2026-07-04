import { useMemo, useState } from 'react';
import {
  ITEMIZED_CATEGORIES,
  isUsdPending,
  type Expense,
  type ItemizedCategory,
  type Payment,
} from '../types';
import { money } from '../lib/format';

interface Props {
  expenses: Expense[];
  onUpdate: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
}

function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ExpenseList({ expenses, onUpdate, onDelete }: Props) {
  const [pendingOnly, setPendingOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...expenses]
        .filter((e) => !pendingOnly || isUsdPending(e))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [expenses, pendingOnly],
  );

  const pendingCount = useMemo(
    () => expenses.filter(isUsdPending).length,
    [expenses],
  );

  if (expenses.length === 0) {
    return <p className="muted">No expenses yet. Add one from the Entry tab.</p>;
  }

  return (
    <div className="stack">
      <label className="filter">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={(e) => setPendingOnly(e.target.checked)}
        />
        <span>USD pending only ({pendingCount})</span>
      </label>

      {sorted.length === 0 ? (
        <p className="muted">No USD-pending expenses.</p>
      ) : (
        <ul className="list">
          {sorted.map((e) =>
            editing === e.id ? (
              <EditRow
                key={e.id}
                expense={e}
                onSave={(patch) => {
                  onUpdate(e.id, patch);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
                onDelete={() => {
                  onDelete(e.id);
                  setEditing(null);
                }}
              />
            ) : (
              <li key={e.id} className="row" onClick={() => setEditing(e.id)}>
                <div className="row__main">
                  <span className="row__cat">{e.category}</span>
                  {e.note && <span className="row__note">{e.note}</span>}
                </div>
                <div className="row__meta">
                  <span className="row__amounts">
                    {money(e.amount_gbp, 'GBP')} · {money(e.amount_usd, 'USD')}
                  </span>
                  <span className="row__sub">
                    {e.date} · {e.payment === 'GTCC' ? 'GTCC' : 'Personal'}
                    {isUsdPending(e) && (
                      <span className="badge">USD pending</span>
                    )}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

interface EditProps {
  expense: Expense;
  onSave: (patch: Partial<Expense>) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function EditRow({ expense, onSave, onCancel, onDelete }: EditProps) {
  const [date, setDate] = useState(expense.date);
  const [category, setCategory] = useState<ItemizedCategory>(expense.category);
  const [gbp, setGbp] = useState(expense.amount_gbp?.toString() ?? '');
  const [usd, setUsd] = useState(expense.amount_usd?.toString() ?? '');
  const [payment, setPayment] = useState<Payment>(expense.payment);
  const [note, setNote] = useState(expense.note);

  return (
    <li className="row row--edit">
      <label className="field">
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ItemizedCategory)}
        >
          {ITEMIZED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>GBP</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={gbp}
            onChange={(e) => setGbp(e.target.value)}
          />
        </label>
        <label className="field">
          <span>USD</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
          />
        </label>
      </div>
      <div className="field">
        <span>Payment</span>
        <div className="toggle">
          {(['GTCC', 'personal'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`toggle__opt${payment === p ? ' toggle__opt--on' : ''}`}
              onClick={() => setPayment(p)}
            >
              {p === 'GTCC' ? 'GTCC' : 'Personal'}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Note</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="form__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() =>
            onSave({
              date,
              category,
              amount_gbp: parseAmount(gbp),
              amount_usd: parseAmount(usd),
              payment,
              note: note.trim(),
            })
          }
        >
          Save
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
