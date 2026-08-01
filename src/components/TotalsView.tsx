import { useState, type ReactNode } from 'react';
import type {
  Category,
  DtsAccountExpected,
  DtsExpected,
  Expense,
  MieSegment,
} from '../types';
import { money } from '../lib/format';
import {
  totalsByCategory,
  totalsByAccount,
  usdPendingCountsByCategory,
  usdPendingCountsByAccount,
} from '../lib/totals';
import {
  reconcileCategories,
  reconcileAccounts,
  reconcileAccountTotal,
  mismatchCount,
  type Reconcile,
} from '../lib/reconcile';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
  expected: DtsExpected;
  accountExpected: DtsAccountExpected;
  onSetDts: (category: Category, value: number | null) => void;
  onSetAccountDts: (
    key: keyof DtsAccountExpected,
    value: number | null,
  ) => void;
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
  const totalRecon = reconcileAccountTotal(byAccount, accountExpected);
  const catMismatches = mismatchCount(categoryRecon);
  const acctMismatches = mismatchCount([
    ...accountRecon,
    { usd: totalRecon },
  ]);

  const catPending = usdPendingCountsByCategory(expenses);
  const acctPending = usdPendingCountsByAccount(expenses);
  const catIncomplete = [...catPending.values()].filter((n) => n > 0).length;
  // All expenses, USD, before the GTCC/personal split.
  const totalPendingCount = acctPending.gtcc + acctPending.personal;
  const acctIncomplete =
    (totalPendingCount > 0 ? 1 : 0) +
    (acctPending.gtcc > 0 ? 1 : 0) +
    (acctPending.personal > 0 ? 1 : 0);

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
        {catIncomplete > 0 && (
          <p className="recon__summary recon__summary--warn">
            {catIncomplete} row{catIncomplete > 1 ? 's' : ''} with missing USD
          </p>
        )}
        <div className="recon">
          {categoryRecon.map((r) => {
            const pendingCount = catPending.get(r.category) ?? 0;
            return (
              <ReconLine
                key={r.category}
                label={
                  <>
                    {r.category}
                    {r.category === 'M&IE' && <span className="tag">per-diem</span>}
                    {pendingCount > 0 && (
                      <span className="tag tag--warn">
                        {pendingCount} missing USD
                      </span>
                    )}
                  </>
                }
                rec={r.usd}
                usdPendingCount={pendingCount}
                value={expected[r.category] ?? null}
                ariaLabel={`DTS USD total for ${r.category}`}
                onChange={(v) => onSetDts(r.category, v)}
              />
            );
          })}
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
        {acctIncomplete > 0 && (
          <p className="recon__summary recon__summary--warn">
            {acctIncomplete} row{acctIncomplete > 1 ? 's' : ''} with missing USD
          </p>
        )}
        <div className="recon">
          <ReconLine
            label={
              <>
                Total
                {totalPendingCount > 0 && (
                  <span className="tag tag--warn">
                    {totalPendingCount} missing USD
                  </span>
                )}
              </>
            }
            rec={totalRecon}
            usdPendingCount={totalPendingCount}
            value={accountExpected.total}
            ariaLabel="DTS USD total for all expenses"
            onChange={(v) => onSetAccountDts('total', v)}
          />
          <ReconLine
            label={
              <>
                GTCC
                {acctPending.gtcc > 0 && (
                  <span className="tag tag--warn">
                    {acctPending.gtcc} missing USD
                  </span>
                )}
              </>
            }
            rec={accountRecon[0].usd}
            usdPendingCount={acctPending.gtcc}
            value={accountExpected.gtcc}
            ariaLabel="DTS USD reimbursement for GTCC"
            onChange={(v) => onSetAccountDts('gtcc', v)}
          />
          <ReconLine
            label={
              <>
                Personal
                {acctPending.personal > 0 && (
                  <span className="tag tag--warn">
                    {acctPending.personal} missing USD
                  </span>
                )}
              </>
            }
            rec={accountRecon[1].usd}
            usdPendingCount={acctPending.personal}
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
  usdPendingCount = 0,
  value,
  ariaLabel,
  onChange,
}: {
  label: ReactNode;
  rec: Reconcile;
  usdPendingCount?: number;
  value: number | null;
  ariaLabel: string;
  onChange: (value: number | null) => void;
}) {
  // A row missing USD is incomplete: its DTS comparison is premature, so the
  // yellow "incomplete" border wins over the red/green status border (#14).
  // The mismatch/match flag itself still reflects the underlying comparison.
  const incomplete = usdPendingCount > 0;
  const rowModifier = incomplete ? 'incomplete' : rec.status;
  return (
    <div className={`recon__row recon__row--${rowModifier}`}>
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
