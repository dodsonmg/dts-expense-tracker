# DTS Expense Tracker

An offline-first PWA for capturing trip expenses on an iPhone and reconciling
them against the **Defense Travel System (DTS)** — checking category totals and
the GTCC-vs-personal split.

No backend, no accounts, no sync. All data lives on the device (IndexedDB); the
only thing that leaves is a CSV you choose to email to yourself. It's built to
work in two places: as a live app (at home), and as an exported spreadsheet (at
the office, where phones aren't allowed). See [`SPEC.md`](./SPEC.md) for the full
product spec.

## Features

- **Fast expense entry** — category and payment dropdowns, GBP and USD side by
  side, date defaulting to today but freely editable.
- **Dual currency, no conversion** — GBP (receipt) and USD (DTS) are tracked
  separately and **never summed together**. An expense with GBP but no USD yet
  is flagged **"USD pending."**
- **M&IE per-diem calculator** — multi-segment (full/partial days × rates),
  USD only, always counted toward the Personal account.
- **MILEAGE calculator** — miles × rate computes the USD amount, but (unlike
  M&IE) each leg stays its own itemized row, since DTS shows mileage
  leg-by-leg rather than as one lump total.
- **DTS reconciliation** — enter the USD totals DTS shows per category and per
  account (GTCC/Personal reimbursement); the app flags mismatches with a signed
  delta, and separately flags a row as **"incomplete"** (yellow) if any of its
  expenses are still USD-pending, since that comparison is premature. Mark each
  expense **"entered in DTS"** and filter the outstanding ones.
- **Exports for the office** — a formatted **`.xlsx`** (ExcelJS) with the
  reconciliation tables — mismatches and incomplete rows highlighted — at the
  top and raw rows behind, plus a plain **CSV** (`usd_incomplete` column).
  Shared via the iOS share sheet (Mail) or downloaded; both usable as
  standalone spreadsheets.
- **Installable & offline** — "Add to Home Screen"; works with no signal after
  first load.

## Tech stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript (strict)
- [localForage](https://localforage.github.io/localForage/) over IndexedDB
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker, manifest)
- CSV export is hand-rolled (no dependency); `.xlsx` via
  [ExcelJS](https://github.com/exceljs/exceljs), lazy-loaded and precached
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
  types.ts          Domain model + fixed category set; isUsdPending / isEntered
  db.ts             IndexedDB load/save (localForage)
  useTripData.ts    The one stateful hook (loads once, mirrors to IndexedDB)
  lib/              Pure logic, no React — unit-tested
    mie.ts          M&IE per-diem math
    mileage.ts      MILEAGE calculator (miles × rate)
    totals.ts       By-category / by-account totals (GBP & USD separate)
    reconcile.ts    App-vs-DTS comparison (USD, cent tolerance)
    report.ts       Shared export model consumed by both exporters
    csv.ts          CSV export
    xlsx.ts         Formatted .xlsx export (ExcelJS, dynamically imported)
    format.ts       Currency + date helpers
  components/       One file per screen (Entry, List, M&IE, Totals, Export)
  App.tsx           Tab shell
scripts/gen-icons.mjs  Dependency-free PNG icon generator
```

The domain invariants that keep the tool honest (currencies never summed, M&IE
always USD→Personal, USD-only reconciliation, fixed category order, the
"USD pending" / "entered in DTS" rules) are documented in
[`CLAUDE.md`](./CLAUDE.md) and covered by tests in `src/lib` and `src/*.test.ts`.

## Testing

```bash
npm test          # unit tests for the lib layer + component tests
npm run coverage
```

Tests focus on the pure calculation/export layer (the parts that must be correct
to reconcile against DTS) — including an `.xlsx` round-trip that reads the
written workbook back — plus the interactive components (entry, list, totals,
export).

## Deployment

Deployed to **GitHub Pages** via GitHub Actions on every push to `main`:
<https://dodsonmg.github.io/dts-expense-tracker/>. `vite.config.ts` sets `base`
to `/dts-expense-tracker/` for Pages; set `VITE_BASE=/` for a root deploy
(Netlify / custom domain):

```bash
VITE_BASE=/ npm run build
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests, and build on
pushes and PRs; `deploy.yml` publishes `dist/` to Pages.

Replace the placeholder PWA icons in `public/` with real artwork before
shipping (`npm run gen-icons` regenerates the placeholders).

## Roadmap

**Phase 1 (MVP)** and **Phase 2 (reconciliation)** are implemented and deployed.
Remaining phases in [`SPEC.md`](./SPEC.md):

- **Phase 3 — multi-trip + robustness:** multiple trips, backup/restore,
  PWA/offline polish. (Mileage calculator done.)
- **Phase 4 — nice-to-haves:** receipt photos, interactive laptop import.
