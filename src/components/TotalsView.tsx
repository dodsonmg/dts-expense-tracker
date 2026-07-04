import { useState, type ReactNode } from 'react';
import type {
  Account,
  Category,
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { money } from '../lib/format';
import { totalsByCategory, totalsByAccount } from '../lib/totals';
import {
  reconcileCategories,
  reconcileAccounts,
  mismatchCount,
  type Reconcile,
} from '../lib/reconcile';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
  expected: DtsExpected;
  accountExpected: DtsAccountExpected;
  onSetDts: (category: Category, value: number | null) => void;
  onSetAccountDts: (account: Account, value: number | null) => void;
}

function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// DTS reports USD only, so both reconciliations compare USD app totals against
// the USD totals the user reads off DTS.
export function TotalsView({
  expenses,
  segments,
  expected,
  accountExpected,
  onSetDts,
  onSetAccountDts,
}: Props) {
  const byCategory = totalsByCategory(expenses, segments);
  const byAccount = totalsByAccount(expenses, segments);
  const categoryRecon = reconcileCategories(byCategory, expected);
  const accountRecon = reconcileAccounts(byAccount, accountExpected);
  const catMismatches = mismatchCount(categoryRecon);
  const acctMismatches = mismatchCount(accountRecon);

  return (
    <div className="stack">
      <section>
        <h2>By category — reconcile vs DTS (USD)</h2>
        <p className="muted small">
          Enter the total DTS shows for each category; mismatches are flagged.
        </p>
        {catMismatches > 0 && (
          <p className="recon__summary">
            {catMismatches} mismatch{catMismatches > 1 ? 'es' : ''} vs DTS
          </p>
        )}
        <div className="recon">
          {categoryRecon.map((r) => (
            <ReconLine
              key={r.category}
              label={
                <>
                  {r.category}
                  {r.category === 'M&IE' && <span className="tag">per-diem</span>}
                </>
              }
              rec={r.usd}
              value={expected[r.category] ?? null}
              ariaLabel={`DTS USD total for ${r.category}`}
              onChange={(v) => onSetDts(r.category, v)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>By account — reconcile reimbursement (USD)</h2>
        <p className="muted small">
          Verify the split disbursement: GTCC charges repay the card,
          out-of-pocket goes to the bank. M&amp;IE always counts toward Personal.
        </p>
        {acctMismatches > 0 && (
          <p className="recon__summary">
            {acctMismatches} mismatch{acctMismatches > 1 ? 'es' : ''} vs DTS
          </p>
        )}
        <div className="recon">
          <ReconLine
            label="GTCC"
            rec={accountRecon[0].usd}
            value={accountExpected.gtcc}
            ariaLabel="DTS USD reimbursement for GTCC"
            onChange={(v) => onSetAccountDts('gtcc', v)}
          />
          <ReconLine
            label="Personal"
            rec={accountRecon[1].usd}
            value={accountExpected.personal}
            ariaLabel="DTS USD reimbursement for Personal"
            onChange={(v) => onSetAccountDts('personal', v)}
          />
        </div>
      </section>
    </div>
  );
}

// One reconcile row: label, app USD total, editable DTS input, mismatch flag.
function ReconLine({
  label,
  rec,
  value,
  ariaLabel,
  onChange,
}: {
  label: ReactNode;
  rec: Reconcile;
  value: number | null;
  ariaLabel: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className={`recon__row recon__row--${rec.status}`}>
      <span className="recon__name">{label}</span>
      <span className="recon__app">{money(rec.app, 'USD')}</span>
      <DtsInput value={value} label={ariaLabel} onChange={onChange} />
      <span className="recon__flag">
        {rec.status === 'mismatch' ? (
          <span
            className="recon__delta"
            aria-label={`off by ${money(Math.abs(rec.delta ?? 0), 'USD')}`}
          >
            {`${(rec.delta ?? 0) > 0 ? '+' : '−'}${money(
              Math.abs(rec.delta ?? 0),
              'USD',
            )}`}
          </span>
        ) : rec.status === 'match' ? (
          <span className="recon__ok" aria-label="matches DTS">
            ✓
          </span>
        ) : null}
      </span>
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
