import { useState } from 'react';
import {
  ITEMIZED_CATEGORIES,
  type Expense,
  type ItemizedCategory,
  type Payment,
} from '../types';
import { today, money } from '../lib/format';
import { mileageAmountUsd } from '../lib/mileage';

interface Props {
  onAdd: (data: Omit<Expense, 'id'>) => void;
  onDone: () => void;
}

// Parse a currency/miles/rate input: blank -> null, otherwise a non-negative
// number.
function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Optimized for fast repeated entry: after saving, amounts and note clear but
// date/category/payment persist for the next row. MILEAGE's rate also
// persists (same rate usually applies to every leg of a trip); miles clears.
export function EntryForm({ onAdd, onDone }: Props) {
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<ItemizedCategory>('LODGING');
  const [gbp, setGbp] = useState('');
  const [usd, setUsd] = useState('');
  const [miles, setMiles] = useState('');
  const [rate, setRate] = useState('');
  const [payment, setPayment] = useState<Payment>('GTCC');
  const [note, setNote] = useState('');

  const isMileage = category === 'MILEAGE';
  const milesNum = parseAmount(miles);
  const rateNum = parseAmount(rate);
  const mileageUsd =
    milesNum != null && rateNum != null
      ? mileageAmountUsd(milesNum, rateNum)
      : null;

  const amountGbp = isMileage ? null : parseAmount(gbp);
  const amountUsd = isMileage ? mileageUsd : parseAmount(usd);
  const canSave = amountGbp != null || amountUsd != null;

  function save(thenDone: boolean) {
    if (!canSave) return;
    onAdd({
      date,
      category,
      amount_gbp: amountGbp,
      amount_usd: amountUsd,
      payment,
      note: note.trim(),
      entered: false, // new expenses haven't been keyed into DTS yet
      miles: isMileage ? milesNum : null,
      rate: isMileage ? rateNum : null,
    });
    setGbp('');
    setUsd('');
    setMiles('');
    setNote('');
    if (thenDone) onDone();
  }

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
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

      {isMileage ? (
        <>
          <div className="field-row">
            <label className="field">
              <span>Miles</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="0.0"
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
                placeholder="0.000"
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
            <span>GBP (receipt)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={gbp}
              onChange={(e) => setGbp(e.target.value)}
            />
          </label>
          <label className="field">
            <span>USD (DTS)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="pending"
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
        <span>Note (vendor / receipt ref)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="optional"
        />
      </label>

      <div className="form__actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!canSave}
        >
          Save &amp; add another
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canSave}
          onClick={() => save(true)}
        >
          Save &amp; view list
        </button>
      </div>
      {!canSave && !isMileage && (
        <p className="muted small">Enter a GBP or USD amount to save.</p>
      )}
    </form>
  );
}
