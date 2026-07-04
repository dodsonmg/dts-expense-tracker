import { useState } from 'react';
import type {
  Category,
  Currency,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { money } from '../lib/format';
import { totalsByCategory, totalsByAccount } from '../lib/totals';
import {
  reconcileCategories,
  mismatchCount,
  type CurrencyReconcile,
} from '../lib/reconcile';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
  expected: DtsExpected;
  onSetDts: (
    category: Category,
    currency: Currency,
    value: number | null,
  ) => void;
}

function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Two tables, GBP and USD kept separate throughout (never summed together).
// "By category" doubles as the DTS reconciliation view.
export function TotalsView({ expenses, segments, expected, onSetDts }: Props) {
  const byCategory = totalsByCategory(expenses, segments);
  const byAccount = totalsByAccount(expenses, segments);
  const recon = reconcileCategories(byCategory, expected);
  const mismatches = mismatchCount(recon);

  return (
    <div className="stack">
      <section>
        <h2>By category — reconcile vs DTS</h2>
        <p className="muted small">
          Enter the total DTS shows for each category; mismatches are flagged.
          GBP and USD are checked separately and never summed.
        </p>
        {mismatches > 0 && (
          <p className="recon__summary">
            {mismatches} mismatch{mismatches > 1 ? 'es' : ''} vs DTS
          </p>
        )}

        <div className="recon">
          {recon.map((r) => (
            <div key={r.category} className="recon__cat">
              <div className="recon__name">
                {r.category}
                {r.category === 'M&IE' && <span className="tag">per-diem</span>}
              </div>
              {(['GBP', 'USD'] as const).map((currency) => {
                const cell: CurrencyReconcile =
                  currency === 'GBP' ? r.gbp : r.usd;
                const stored =
                  (currency === 'GBP'
                    ? expected[r.category]?.gbp
                    : expected[r.category]?.usd) ?? null;
                return (
                  <div
                    key={currency}
                    className={`recon__row recon__row--${cell.status}`}
                  >
                    <span className="recon__cur">{currency}</span>
                    <span className="recon__app">
                      {money(cell.app, currency)}
                    </span>
                    <DtsInput
                      value={stored}
                      label={`DTS ${currency} total for ${r.category}`}
                      onChange={(v) => onSetDts(r.category, currency, v)}
                    />
                    <span className="recon__flag">
                      {cell.status === 'mismatch' ? (
                        <span
                          className="recon__delta"
                          aria-label={`${currency} off by ${money(
                            Math.abs(cell.delta ?? 0),
                            currency,
                          )}`}
                        >
                          {`${(cell.delta ?? 0) > 0 ? '+' : '−'}${money(
                            Math.abs(cell.delta ?? 0),
                            currency,
                          )}`}
                        </span>
                      ) : cell.status === 'match' ? (
                        <span className="recon__ok" aria-label="matches DTS">
                          ✓
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>By account</h2>
        <p className="muted small">
          Verifies the split disbursement: GTCC charges repay the card,
          out-of-pocket goes to the bank. M&amp;IE always counts toward Personal.
        </p>
        <table className="totals">
          <thead>
            <tr>
              <th>Account</th>
              <th className="num">GBP</th>
              <th className="num">USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GTCC</td>
              <td className="num">
                {byAccount.gtcc.gbp ? money(byAccount.gtcc.gbp, 'GBP') : '—'}
              </td>
              <td className="num">
                {byAccount.gtcc.usd ? money(byAccount.gtcc.usd, 'USD') : '—'}
              </td>
            </tr>
            <tr>
              <td>Personal</td>
              <td className="num">
                {byAccount.personal.gbp
                  ? money(byAccount.personal.gbp, 'GBP')
                  : '—'}
              </td>
              <td className="num">
                {byAccount.personal.usd
                  ? money(byAccount.personal.usd, 'USD')
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

// Local string state lets the user type decimals ("12.") smoothly while the
// parsed value flows out to storage. Seeded once from the stored value (the
// trip has finished loading before this view mounts).
function DtsInput({
  value,
  label,
  onChange,
}: {
  value: number | null;
  label: string;
  onChange: (value: number | null) => void;
}) {
  const [raw, setRaw] = useState(value == null ? '' : String(value));
  return (
    <input
      className="recon__input"
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      placeholder="DTS"
      aria-label={label}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
    />
  );
}
