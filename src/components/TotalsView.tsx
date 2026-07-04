import type { Expense, MieSegment } from '../types';
import { money } from '../lib/format';
import { totalsByCategory, totalsByAccount } from '../lib/totals';

interface Props {
  expenses: Expense[];
  segments: MieSegment[];
}

// Two tables, GBP and USD kept separate throughout (never summed together).
export function TotalsView({ expenses, segments }: Props) {
  const byCategory = totalsByCategory(expenses, segments);
  const byAccount = totalsByAccount(expenses, segments);

  const catGbp = byCategory.reduce((s, r) => s + r.gbp, 0);
  const catUsd = byCategory.reduce((s, r) => s + r.usd, 0);

  return (
    <div className="stack">
      <section>
        <h2>By category</h2>
        <table className="totals">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">GBP</th>
              <th className="num">USD</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((r) => (
              <tr key={r.category}>
                <td>
                  {r.category}
                  {r.category === 'M&IE' && (
                    <span className="tag">per-diem</span>
                  )}
                </td>
                <td className="num">{r.gbp ? money(r.gbp, 'GBP') : '—'}</td>
                <td className="num">{r.usd ? money(r.usd, 'USD') : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <th className="num">{money(catGbp, 'GBP')}</th>
              <th className="num">{money(catUsd, 'USD')}</th>
            </tr>
          </tfoot>
        </table>
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
