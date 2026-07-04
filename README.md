# DTS Expense Tracker

An offline-first PWA for capturing trip expenses on an iPhone and reconciling
them against the **Defense Travel System (DTS)** — checking category totals and
the GTCC-vs-personal split.

No backend, no accounts, no sync. All data lives on the device (IndexedDB); the
only thing that leaves is a CSV you choose to email to yourself. It's built to
work in two places: as a live app (at home), and as an exported spreadsheet (at
the office, where phones aren't allowed). See [`SPEC.md`](./SPEC.md) for the full
product spec.

## Features (MVP)

- **Fast expense entry** — category and payment dropdowns, GBP and USD side by
  side, date defaulting to today but freely editable.
- **Dual currency, no conversion** — GBP (receipt) and USD (DTS) are tracked
  separately and **never summed together**. An expense with GBP but no USD yet
  is flagged **"USD pending."**
- **M&IE per-diem calculator** — multi-segment (full/partial days × rates),
  USD only, always counted toward the Personal account.
- **Live totals** — by category (fixed DTS order) and by account (GTCC vs
  Personal), GBP and USD kept in separate columns.
- **One-tap CSV export** — raw rows plus a totals block, shared via the iOS
  share sheet (Mail) or downloaded. Usable as a standalone spreadsheet.
- **Installable & offline** — "Add to Home Screen"; works with no signal after
  first load.

## Tech stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript (strict)
- [localForage](https://localforage.github.io/localForage/) over IndexedDB
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker, manifest)
- CSV export is hand-rolled (no dependency)
- [Vitest](https://vitest.dev) + Testing Library, ESLint (flat config)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173/dts-expense-tracker/
```

The app is best viewed in a mobile viewport (Chrome/Safari DevTools device
mode). Data persists across reloads via IndexedDB.

### Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Serve the production build (test PWA/offline here) |
| `npm run typecheck` | `tsc` without emitting |
| `npm run lint` | ESLint over the project |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Test coverage report |
| `npm run gen-icons` | Regenerate placeholder PWA icons |

> **PWA note:** the service worker only runs against a built app. To test
> install/offline behavior, run `npm run build && npm run preview` and open it
> on the phone (localhost or HTTPS).

## Project structure

```
src/
  types.ts          Domain model + fixed category set; isUsdPending
  db.ts             IndexedDB load/save (localForage)
  useTripData.ts    The one stateful hook (loads once, mirrors to IndexedDB)
  lib/              Pure logic, no React — unit-tested
    mie.ts          M&IE per-diem math
    totals.ts       By-category / by-account totals (GBP & USD separate)
    csv.ts          Export document
    format.ts       Currency + date helpers
  components/       One file per screen (Entry, List, M&IE, Totals, Export)
  App.tsx           Tab shell
scripts/gen-icons.mjs  Dependency-free PNG icon generator
```

The domain invariants that keep the tool honest (currencies never summed, M&IE
always USD→Personal, fixed category order, "USD pending" rule) are documented in
[`CLAUDE.md`](./CLAUDE.md) and covered by tests in `src/lib` and `src/types.test.ts`.

## Testing

```bash
npm test          # 26 tests across the lib layer + EntryForm
npm run coverage
```

Tests focus on the pure calculation/export layer (the parts that must be correct
to reconcile against DTS) plus the entry form's save behavior.

## Deployment

Any static host with HTTPS works. `vite.config.ts` sets `base` to
`/dts-expense-tracker/` for **GitHub Pages**; set `VITE_BASE=/` for a root
deploy (Netlify / custom domain):

```bash
VITE_BASE=/ npm run build
```

Replace the placeholder PWA icons in `public/` with real artwork before
shipping (`npm run gen-icons` regenerates the placeholders).

> CI (GitHub Actions running lint + test on push) is planned but not yet
> configured.

## Roadmap

This scaffold is **Phase 1 (MVP)**. Later phases in [`SPEC.md`](./SPEC.md):

- **Phase 2 — reconciliation:** check off items as "entered in DTS," enter DTS's
  category totals and flag mismatches, formatted `.xlsx` export.
- **Phase 3 — multi-trip + robustness:** multiple trips, backup/restore,
  PWA/offline polish, optional mileage calculator.
- **Phase 4 — nice-to-haves:** receipt photos, interactive laptop import.
