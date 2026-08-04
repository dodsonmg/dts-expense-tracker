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

- **Fast expense entry** — category and payment dropdowns, foreign-currency
  (**£€¥**) and USD side by side, date defaulting to today but freely
  editable. The **£€¥** field isn't currency-specific — it just means
  "whatever's on the receipt," pounds, euros, yen, or otherwise.
- **Dual currency, no conversion** — the foreign-currency amount (receipt) and
  USD (DTS) are tracked separately and **never summed together**. An expense
  with a foreign amount but no USD yet is flagged **"USD pending."**
- **M&IE per-diem calculator** — multi-segment (full/partial days × rates),
  USD only, always counted toward the Personal account.
- **MILEAGE calculator** — miles × rate computes the USD amount, but (unlike
  M&IE) each leg stays its own itemized row, since DTS shows mileage
  leg-by-leg rather than as one lump total. A toggle switches to manual
  USD/foreign-currency entry when the calculator doesn't fit.
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
- **Receipt photos** — attach one photo per expense, either as you add it or
  later from the List; it's downscaled on capture so a trip's receipts stay
  small. Tap the **Photo** marker on a row to view it full-screen. For the
  office, a **receipts `.zip`** bundles the `.xlsx` with one image per
  receipt, named to match the sheet's **Receipt #** column — key line *N* into
  DTS and attach `receipt-0N.jpg` as evidence. Photos live on the device only
  and are the one thing the backup file doesn't carry.
- **Multi-trip** — create/rename/delete trips from the header's trip switcher;
  each trip's expenses/M&IE segments/DTS totals are stored separately, and
  export is always scoped to whichever trip is active. A device always has
  at least one trip. Finished trips can be **archived** (hidden, not
  deleted) via the same switcher, and unarchived just as easily.
- **Backup/restore** — a single JSON file with every trip on the device
  (expenses, M&IE segments, DTS totals — but not receipt photos, which stay
  local), for moving to a new phone. Restoring
  **replaces** every trip on the device; a confirmation step shows what will
  be replaced before it happens. A dismissible toast nudges toward backing up
  once it's been a while and enough has changed since the last one.
- **Installable & offline** — "Add to Home Screen"; works with no signal after
  first load. A dismissible toast surfaces when an update is ready to reload,
  or when the app is confirmed ready to work offline.
- **Help tab** — install steps plus an FAQ walking through the domain
  concepts above (USD pending vs. incomplete vs. mismatch, M&IE vs. MILEAGE,
  what "entered in DTS" does, and so on).

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
| `npm run gen-icons` | Regenerate the app icon (hedgehog) |

> **PWA note:** the service worker only runs against a built app. To test
> install/offline behavior, run `npm run build && npm run preview` and open it
> on the phone (localhost or HTTPS).

## Project structure

```
src/
  types.ts          Domain model + fixed category set; isUsdPending / isEntered / hasPhoto
  db.ts             IndexedDB load/save (localForage), per-trip prefixed keys
  useTrips.ts       Trip list + active trip id; create/rename/delete/select/archive
  useTripData.ts    One trip's data (keyed by tripId, reloads on trip switch)
  useAllTripsData.ts  Read-only cross-trip expense counts (backup nudge only)
  useBackupNudge.ts Dismissible "time to back up" threshold logic
  lib/              Pure logic, no React — unit-tested
    id.ts           Shared id generator (useTrips / useTripData)
    mie.ts          M&IE per-diem math
    mileage.ts      MILEAGE calculator (miles × rate)
    totals.ts       By-category / by-account totals (GBP & USD separate)
    reconcile.ts    App-vs-DTS comparison (USD, cent tolerance)
    report.ts       Shared export model consumed by both exporters
    csv.ts          CSV export (per-trip filename)
    xlsx.ts         Formatted .xlsx export (ExcelJS, dynamically imported)
    zip.ts          Receipts bundle: .xlsx + numbered photos (JSZip, dynamic)
    photo.ts        Receipt photo downscale/re-encode before storage
    backup.ts       Whole-device JSON backup/restore (all trips; v1→v2 migration)
    format.ts       Currency + date helpers; slugify (export filenames)
  components/       One file per screen (Entry, List, M&IE, Totals, Export,
                    Help) + TripSwitcher (header) + UpdateToast/BackupNudgeToast (banners)
                    + PhotoField (shared picker) / PhotoLightbox (full-screen view)
  App.tsx           Tab shell
scripts/gen-icons.mjs  Rasterizes the hedgehog SVG to every icon size
                       (Playwright/headless Chromium)
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

The app icon is regenerated with `npm run gen-icons` (needs
`npx playwright install chromium` once per machine — see `scripts/gen-icons.mjs`).

## Roadmap

**Phase 1 (MVP)** through **Phase 3 (multi-trip + robustness)** are implemented
and deployed, plus **Phase 5 (trip archiving & backup nudge)** — see
[`SPEC.md`](./SPEC.md) for details. Remaining:

- **Phase 4 — nice-to-haves:** ~~receipt photos~~ (done — see above);
  interactive laptop import is not started.
