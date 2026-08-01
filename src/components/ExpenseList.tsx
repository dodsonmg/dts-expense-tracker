import { useMemo, useState } from 'react';
import {
  ITEMIZED_CATEGORIES,
  isEntered,
  isUsdPending,
  type Expense,
  type ItemizedCategory,
  type Payment,
} from '../types';
import { money } from '../lib/format';
import { describeMileage, mileageAmountUsd } from '../lib/mileage';

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
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...expenses]
        .filter((e) => !pendingOnly || isUsdPending(e))
        .filter((e) => !outstandingOnly || !isEntered(e))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [expenses, pendingOnly, outstandingOnly],
  );

  const pendingCount = useMemo(
    () => expenses.filter(isUsdPending).length,
    [expenses],
  );
  const outstandingCount = useMemo(
    () => expenses.filter((e) => !isEntered(e)).length,
    [expenses],
  );

  if (expenses.length === 0) {
    return <p className="muted">No expenses yet. Add one from the Entry tab.</p>;
  }

  return (
    <div className="stack">
      <div className="filters">
        <label className="filter">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
          />
          <span>USD pending only ({pendingCount})</span>
        </label>
        <label className="filter">
          <input
            type="checkbox"
            checked={outstandingOnly}
            onChange={(e) => setOutstandingOnly(e.target.checked)}
          />
          <span>Not entered in DTS only ({outstandingCount})</span>
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="muted">No expenses match the current filters.</p>
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
              <li
                key={e.id}
                className={`row${isEntered(e) ? ' row--entered' : ''}`}
              >
                <button
                  type="button"
                  className={`row__check${isEntered(e) ? ' row__check--on' : ''}`}
                  aria-pressed={isEntered(e)}
                  aria-label={
                    isEntered(e)
                      ? 'Entered in DTS — tap to unmark'
                      : 'Mark as entered in DTS'
                  }
                  onClick={() => onUpdate(e.id, { entered: !isEntered(e) })}
                >
                  <span aria-hidden>{isEntered(e) ? '✓' : ''}</span>
                </button>
                <div
                  className="row__body"
                  onClick={() => setEditing(e.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') setEditing(e.id);
                  }}
                >
                  <div className="row__main">
                    <span className="row__cat">{e.category}</span>
                    {e.note && <span className="row__note">{e.note}</span>}
                  </div>
                  <div className="row__meta">
                    <span className="row__amounts">
                      {money(e.amount_gbp, 'GBP')} · {money(e.amount_usd, 'USD')}
                    </span>
                    {e.category === 'MILEAGE' &&
                      e.miles != null &&
                      e.rate != null && (
                        <span className="row__sub">
                          {describeMileage(e.miles, e.rate)}
                        </span>
                      )}
                    <span className="row__sub">
                      {e.date} · {e.payment === 'GTCC' ? 'GTCC' : 'Personal'}
                      {isUsdPending(e) && (
                        <span className="badge">USD pending</span>
                      )}
                    </span>
                  </div>
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
  const [miles, setMiles] = useState(expense.miles?.toString() ?? '');
  const [rate, setRate] = useState(expense.rate?.toString() ?? '');
  // A row saved by the calculator (has miles) reopens in calculator mode; a
  // manually-entered or legacy row reopens in manual mode.
  const [mileageManual, setMileageManual] = useState(
    expense.category === 'MILEAGE' && expense.miles == null,
  );
  const [payment, setPayment] = useState<Payment>(expense.payment);
  const [note, setNote] = useState(expense.note);
  const [entered, setEntered] = useState(isEntered(expense));

  const isMileage = category === 'MILEAGE';
  const useCalculator = isMileage && !mileageManual;
  const milesNum = parseAmount(miles);
  const rateNum = parseAmount(rate);
  const mileageUsd =
    milesNum != null && rateNum != null
      ? mileageAmountUsd(milesNum, rateNum)
      : null;

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
      {isMileage && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setMileageManual((m) => !m)}
        >
          {mileageManual
            ? 'Use miles × rate calculator instead'
            : 'Enter USD manually instead'}
        </button>
      )}

      {category === 'LODGING' && (
        <p className="muted small">
          Tip: enter room rate and lodging tax as separate rows so they
          reconcile individually against DTS.
        </p>
      )}
      {useCalculator ? (
        <>
          <div className="field-row">
            <label className="field">
              <span>Miles</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Rate (USD/mi)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
          </div>
          <p className="muted small">
            {mileageUsd != null
              ? `= ${money(mileageUsd, 'USD')}`
              : 'Enter miles and a rate to compute the USD amount.'}
          </p>
        </>
      ) : (
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
      )}
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
      <label className="filter">
        <input
          type="checkbox"
          checked={entered}
          onChange={(e) => setEntered(e.target.checked)}
        />
        <span>Entered in DTS</span>
      </label>
      <div className="form__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() =>
            onSave({
              date,
              category,
              amount_gbp: useCalculator ? null : parseAmount(gbp),
              amount_usd: useCalculator ? mileageUsd : parseAmount(usd),
              payment,
              note: note.trim(),
              entered,
              miles: useCalculator ? milesNum : null,
              rate: useCalculator ? rateNum : null,
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
