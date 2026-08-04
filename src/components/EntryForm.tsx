import { useEffect, useState } from 'react';
import {
  ITEMIZED_CATEGORIES,
  type Expense,
  type ItemizedCategory,
  type Payment,
} from '../types';
import { today, money, FOREIGN_SYMBOL } from '../lib/format';
import { mileageAmountUsd } from '../lib/mileage';
import { PhotoField } from './PhotoField';

interface Props {
  // Returns the new expense's id, so a photo picked before saving can be
  // attached to the row the moment it exists.
  onAdd: (data: Omit<Expense, 'id'>) => string;
  onAttachPhoto: (expenseId: string, blob: Blob) => void;
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
export function EntryForm({ onAdd, onAttachPhoto, onDone }: Props) {
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<ItemizedCategory>('LODGING');
  const [gbp, setGbp] = useState('');
  const [usd, setUsd] = useState('');
  const [miles, setMiles] = useState('');
  const [rate, setRate] = useState('');
  const [mileageManual, setMileageManual] = useState(false);
  const [payment, setPayment] = useState<Payment>('GTCC');
  const [note, setNote] = useState('');
  // Held locally until save: the expense doesn't exist (and has no id) yet.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);

  // Object URLs leak until revoked. Keying the cleanup on `photo` covers every
  // path at once: the previous URL is revoked when one replaces it, when it is
  // cleared on save/remove, and when the form unmounts still holding one.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const isMileage = category === 'MILEAGE';
  const useCalculator = isMileage && !mileageManual;
  const milesNum = parseAmount(miles);
  const rateNum = parseAmount(rate);
  const mileageUsd =
    milesNum != null && rateNum != null
      ? mileageAmountUsd(milesNum, rateNum)
      : null;

  const amountGbp = useCalculator ? null : parseAmount(gbp);
  const amountUsd = useCalculator ? mileageUsd : parseAmount(usd);
  const canSave = amountGbp != null || amountUsd != null;

  function save(thenDone: boolean) {
    if (!canSave) return;
    const id = onAdd({
      date,
      category,
      amount_gbp: amountGbp,
      amount_usd: amountUsd,
      payment,
      note: note.trim(),
      entered: false, // new expenses haven't been keyed into DTS yet
      miles: useCalculator ? milesNum : null,
      rate: useCalculator ? rateNum : null,
      photoIds: [], // attached below, now that the row has an id
    });
    if (photo) onAttachPhoto(id, photo.blob);
    setGbp('');
    setUsd('');
    setMiles('');
    setNote('');
    // Photo is per-expense, so it clears like the amounts — unlike
    // date/category/payment, which persist for the next row.
    setPhoto(null);
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
            <span>{FOREIGN_SYMBOL} (receipt)</span>
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

      <PhotoField
        idPrefix="entry"
        previewUrl={photo?.url ?? null}
        onSelect={(blob) =>
          setPhoto({ blob, url: URL.createObjectURL(blob) })
        }
        onRemove={() => setPhoto(null)}
      />

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
      {!canSave && !useCalculator && (
        <p className="muted small">
          Enter a {FOREIGN_SYMBOL} or USD amount to save.
        </p>
      )}
    </form>
  );
}
