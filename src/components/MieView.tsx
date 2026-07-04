import type { MieSegment } from '../types';
import { money } from '../lib/format';
import { segmentTotal, mieTotalUsd } from '../lib/mie';

interface Props {
  segments: MieSegment[];
  onAdd: (data: Omit<MieSegment, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<MieSegment>) => void;
  onDelete: (id: string) => void;
}

const num = (raw: string): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// M&IE per-diem calculator. USD only; the total always contributes to Personal.
export function MieView({ segments, onAdd, onUpdate, onDelete }: Props) {
  const total = mieTotalUsd(segments);

  return (
    <div className="stack">
      <p className="muted small">
        Per-diem allowance, USD only. Always counts toward the{' '}
        <strong>Personal</strong> account.
      </p>

      {segments.length === 0 && (
        <p className="muted">No segments yet.</p>
      )}

      {segments.map((s) => (
        <div key={s.id} className="card seg">
          <label className="field">
            <span>Location (label)</span>
            <input
              type="text"
              value={s.location}
              placeholder="e.g. RAF Mildenhall"
              onChange={(e) => onUpdate(s.id, { location: e.target.value })}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Full rate (USD)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={s.full_rate || ''}
                onChange={(e) =>
                  onUpdate(s.id, { full_rate: num(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Full days</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={s.full_days || ''}
                onChange={(e) =>
                  onUpdate(s.id, { full_days: num(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Partial rate (USD)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={s.partial_rate || ''}
                onChange={(e) =>
                  onUpdate(s.id, { partial_rate: num(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Partial days</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={s.partial_days || ''}
                onChange={(e) =>
                  onUpdate(s.id, { partial_days: num(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="seg__foot">
            <span className="seg__total">{money(segmentTotal(s), 'USD')}</span>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(s.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn--primary"
        onClick={() =>
          onAdd({
            location: '',
            full_rate: 0,
            partial_rate: 0,
            full_days: 0,
            partial_days: 0,
          })
        }
      >
        ＋ Add segment
      </button>

      <div className="card total-bar">
        <span>M&amp;IE total (USD)</span>
        <strong>{money(total, 'USD')}</strong>
      </div>
    </div>
  );
}
