import { useState } from 'react';
import type { Trip } from '../types';

interface Props {
  trips: Trip[];
  activeTripId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetArchived: (id: string, archived: boolean) => void;
}

// Header control for switching/creating/renaming/deleting/archiving trips.
// An inline `.card` panel toggled open below the header button — no
// portal/modal, same "conditional card in normal flow" pattern ExportView's
// restore-confirmation card uses.
export function TripSwitcher({
  trips,
  activeTripId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSetArchived,
}: Props) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createValue, setCreateValue] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const activeTrip = trips.find((t) => t.id === activeTripId);
  const visibleTrips = trips.filter((t) => !t.archived);
  const archivedTrips = trips.filter((t) => t.archived);

  function closePanel() {
    setOpen(false);
    setRenamingId(null);
    setConfirmDeleteId(null);
    setCreating(false);
    setCreateValue('');
  }

  function startRename(t: Trip) {
    setRenamingId(t.id);
    setRenameValue(t.name);
    setConfirmDeleteId(null);
  }

  function saveRename() {
    if (renamingId) onRename(renamingId, renameValue);
    setRenamingId(null);
  }

  function commitCreate() {
    if (createValue.trim()) onCreate(createValue);
    closePanel();
  }

  function renderRow(t: Trip) {
    return (
      <div key={t.id} className="trip-switch__row">
        {renamingId === t.id ? (
          <>
            <input
              type="text"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <button type="button" className="btn" onClick={saveRename}>
              Save
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setRenamingId(null)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`btn trip-switch__name${t.id === activeTripId ? ' trip-switch__name--active' : ''}`}
              onClick={() => {
                onSelect(t.id);
                closePanel();
              }}
            >
              {t.name}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => startRename(t)}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onSetArchived(t.id, !t.archived)}
            >
              {t.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={trips.length <= 1}
              title={
                trips.length <= 1
                  ? 'At least one trip is required.'
                  : undefined
              }
              onClick={() => setConfirmDeleteId(t.id)}
            >
              Delete
            </button>
          </>
        )}

        {confirmDeleteId === t.id && (
          <div className="card stack">
            <p>
              Delete <strong>{t.name}</strong> and all its expenses?
              This can&apos;t be undone.
            </p>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onDelete(t.id);
                setConfirmDeleteId(null);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="trip-switch">
      <button
        type="button"
        className="trip-switch__toggle"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : setOpen(true))}
      >
        Trip: {activeTrip?.name ?? '…'} ▾
      </button>

      {open && (
        <div className="card stack trip-switch__panel">
          {visibleTrips.map((t) => renderRow(t))}

          {archivedTrips.length > 0 && (
            <>
              <button
                type="button"
                className="btn trip-switch__archived-toggle"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? 'Hide archived' : `Show archived (${archivedTrips.length})`}
              </button>
              {showArchived && archivedTrips.map((t) => renderRow(t))}
            </>
          )}

          {creating ? (
            <div className="trip-switch__row">
              <input
                type="text"
                value={createValue}
                placeholder="Trip name"
                autoFocus
                onChange={(e) => setCreateValue(e.target.value)}
              />
              <button type="button" className="btn btn--primary" onClick={commitCreate}>
                Create
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCreating(false);
                  setCreateValue('');
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setCreating(true)}
            >
              ＋ New trip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
