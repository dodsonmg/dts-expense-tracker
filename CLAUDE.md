# DTS Expense Tracker

Offline-first PWA to capture trip expenses on an iPhone and reconcile them
against the **Defense Travel System (DTS)**. No backend, no accounts, no sync:
all data lives on the device in IndexedDB; the only thing that leaves is a CSV
the user chooses to email. See `SPEC.md` for the full product spec — it is the
source of truth, read it before non-trivial changes.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b + vite build → dist/
npm run preview    # serve the production build (test the PWA/offline here)
npm run typecheck  # tsc -b --noEmit
npm run gen-icons  # regenerate the app icon (hedgehog) in public/
npm run lint       # eslint .
npm test           # vitest run
```

## Stack

- **Vite + React 19 + TypeScript** (strict).
- **localForage** over IndexedDB for persistence (`src/db.ts`).
- **vite-plugin-pwa** (`registerType: 'autoUpdate'`) for install + offline.
- CSV export is hand-rolled, no dependency (`src/lib/csv.ts`).

## Architecture

- `src/types.ts` — domain types + the fixed `CATEGORIES` list/order, plus
  `isUsdPending`. Also `Trip` (id/name/createdAt) and `TripBackup` (a `Trip`
  plus its full data — the unit whole-device backup and bulk restore operate
  on). Single source of truth for the data model.
- `src/db.ts` — IndexedDB load/save, one localforage instance. Per-trip data
  (expenses/segments/DTS totals) lives under `trip:<id>:<field>`-prefixed
  keys, not one instance per trip (no registry to enumerate those). Also owns
  the `trips` list + `activeTripId` keys and `ensureInitialized()` — an
  idempotent migration that runs once: if no trip list exists yet, it wraps
  whatever the pre-multi-trip flat keys contain (empty for a fresh install,
  real data for an upgrading user) into one synthetic trip. Those legacy flat
  keys are never deleted (cheap safety net) and never read again afterward.
- `src/useTrips.ts` — owns the trip list, active trip id, and
  create/rename/delete/select. A device always has ≥1 trip — `deleteTrip` is
  a no-op if it's the last one. `restoreFromBackup` writes every trip's data
  from a whole-device backup and bumps `reloadEpoch` (see below).
- `src/useTripData.ts` — one trip's data: `useTripData(tripId, reloadEpoch)`.
  Reloads when `tripId` changes (switching trips) or `reloadEpoch` changes (a
  restore preserves trip ids, so `activeTripId` may not change — the epoch
  forces a re-fetch anyway). `App` composes both hooks and passes slices
  down; components are otherwise presentational.
- `src/lib/` — pure functions, no React:
  - `id.ts` — shared `newId()` (used by both trip hooks).
  - `mie.ts` — M&IE per-diem math.
  - `mileage.ts` — MILEAGE calculator: `mileageAmountUsd` (miles * rate,
    rounded to cents) and `describeMileage` (display string, unrounded to 3dp
    since GSA/DTS rates are sometimes $0.xx5/mile).
  - `totals.ts` — by-category and by-account totals.
  - `reconcile.ts` — compares app totals against DTS-entered totals (USD).
  - `report.ts` — one structured export model consumed by both exporters, so
    CSV and XLSX never drift.
  - `csv.ts` — CSV export document.
  - `xlsx.ts` — formatted `.xlsx` (ExcelJS, dynamically imported to stay out of
    the main bundle).
  - `backup.ts` — whole-**device** JSON backup/restore (`BACKUP_VERSION = 2`):
    `buildBackup(trips: TripBackup[])`, `parseBackup` (structural validation,
    throws `BackupParseError` with a user-presentable message on anything
    malformed; migrates an older v1 single-flat-trip backup into one
    synthetic trip named "Restored trip"). Distinct from `csv.ts`/`xlsx.ts`,
    which are lossy per-trip office-facing views — this round-trips every
    trip's data.
  - `format.ts` — currency + date helpers, plus `slugify` (trip name → safe
    filename fragment, used by `csv.ts`/`xlsx.ts`'s filename generators).
  - `pwaRegister.ts` — re-exports `useRegisterSW` from
    `virtual:pwa-register/react`. Exists purely so tests can `vi.mock` a real
    file path; the virtual specifier itself can't be resolved under
    `vitest.config.ts` (no `VitePWA` plugin there), so mocking it directly
    fails at Vite's import-analysis step before `vi.mock` ever applies.
- `src/components/` — one file per screen: `EntryForm`, `ExpenseList`,
  `MieView`, `TotalsView`, `ExportView`, `HelpView` (static FAQ content, no
  props — the one screen that isn't fed by `useTripData()`), plus
  `TripSwitcher` (mounted in the header, not a tab — reachable from every
  screen). `App.tsx` is the tab shell; it also mounts `UpdateToast` (see
  below).

## Domain invariants — get these wrong and the tool is misleading

1. **Currencies are never summed together.** GBP and USD stay separate; there is
   no conversion. The CSV export keeps both; the in-app Totals screen is a
   USD-only reconciliation view (since DTS is USD).
2. **M&IE is computed, USD only, and always Personal.** It comes from the
   per-diem calculator (`mieTotalUsd`), never from itemized rows. It feeds the
   `M&IE` category row (USD) and the Personal account bucket (USD) — never GTCC,
   never GBP.
3. **Category set is fixed, in fixed order.** Itemized entry excludes `M&IE`
   (`ITEMIZED_CATEGORIES`); totals still show the `M&IE` row.
4. **"USD pending"** = has a GBP amount but no USD amount (charge hasn't landed
   on the card yet). Surfaced as a list filter and a CSV flag. A category/account
   total fed by any USD-pending expense is **"USD incomplete"** — the DTS
   comparison for that row is premature. This is distinct from (and takes visual
   precedence over) a **mismatch**: an incomplete total isn't a reliable signal
   yet, mismatch or not. See `usdPendingCountsByCategory`/`...ByAccount`
   (`totals.ts`), `ReportCategoryRow.usdPendingCount`/`ReportAccountRow.usdPendingCount`.
5. **Amounts are optional** but an expense needs at least one of GBP/USD to save.
6. **Date defaults to today, freely editable** (e.g. foreign-transaction fees
   are dated to the purchase day even though they post later).
7. **`entered` is reconciliation metadata, not money.** It tracks whether an
   expense has been keyed into DTS; it never affects any total. New rows default
   to `false`; legacy rows without the field are normalized to `false` on load
   (`db.ts`). Read it via `isEntered` (defensive against `undefined`). Surfaced
   as a per-row toggle, a "not entered only" list filter, and a CSV column.
8. **DTS reconciliation is USD-only** (DTS reports USD). `DtsExpected` (per
   category) and `DtsAccountExpected` (GTCC/Personal reimbursement) hold the USD
   totals the user reads off DTS; null/absent = unchecked. `reconcileCategories`
   and `reconcileAccounts` compare the app's USD totals at cent precision
   (sub-half-cent gap = match/float noise, larger = mismatch). It's input, not
   truth: it never alters the computed totals. GBP receipts are matched to USD
   entries at the expense level (the List), not here.
9. **MILEAGE stays itemized — it is not M&IE.** DTS shows each mileage leg as
   its own line, so (unlike M&IE's single computed total) each leg must remain
   an individually comparable `Expense` row. The Entry/List forms default the
   plain USD field to a **miles × rate calculator** when `MILEAGE` is selected
   (`Expense.miles`/`.rate`, USD/mile); `amount_usd` is derived at entry/edit
   time via `mileageAmountUsd` but is an ordinary field afterward — editing it
   directly doesn't require touching miles/rate. A link toggle
   (`mileageManual` state) switches to plain GBP/USD entry and back — manual
   entry must stay available (issue #8), the calculator is a default, not a
   replacement. `EditRow` picks its initial mode from the row's data: has
   `miles` → calculator, `miles == null` → manual (covers legacy rows too).
   `miles`/`rate` are plain optional-by-convention fields on `Expense`
   (nullable, like `amount_gbp`/`amount_usd`), not type-enforced to MILEAGE
   only. GBP is forced null only while the calculator is active (no receipt
   currency concept for a computed mileage allowance); the GTCC/personal
   toggle stays, unlike M&IE.
10. **Backup restore is replace-only, never a merge, and it's whole-device.**
    `DtsExpected`/`DtsAccountExpected` are per-category/account singletons
    with no sensible merge rule (which number wins?), so restoring a backup
    always replaces every trip on the device — same mental model as restoring
    a phone from a backup. It is not scoped to the active trip: a backup
    (`lib/backup.ts`'s `Backup.trips`) is every trip's data, and
    `useTrips.restoreFromBackup` is the only way to bulk-replace the trip
    list; `ExportView` gates it behind a confirmation card summarizing every
    trip being replaced before calling it, since it's otherwise irreversible.
11. **A device always has at least one trip.** `useTrips.deleteTrip` is a
    no-op if it's the last remaining trip — there's no "no trip" empty state
    to design for anywhere else in the app. A fresh install or an upgrading
    single-trip user both get exactly one trip via `db.ts`'s
    `ensureInitialized`, auto-created/migrated with no naming prompt.

## Export contract

`buildCsv` emits one file: `EXPENSES` rows (with `usd_pending`,
`entered_in_dts`, and `miles`/`rate` — MILEAGE-only, blank elsewhere —
columns), then `M&IE SEGMENTS`, then `TOTALS BY CATEGORY`,
then `TOTALS BY ACCOUNT`. The two totals blocks carry the DTS comparison
(`dts_usd`, `delta_usd`, `status` where status is `MISMATCH` / `ok` / blank) and
a `usd_incomplete` (`yes`/blank) flag, so the emailed sheet works as the
office's reconciliation view. Money cells are plain 2-dp numbers (or blank) —
no currency glyphs — because the office workstation reconciles the sheet
numerically against DTS.

The formatted `.xlsx` (`buildXlsx`, ExcelJS) renders from the same `report.ts`
model: a **Reconcile** sheet with the by-category and by-account tables at the
top (mismatch rows red, USD-incomplete rows yellow — incomplete wins when
both apply), then **Expenses** (raw rows, USD-pending rows yellow, Miles/Rate
columns before Note) and **M&IE** sheets. Both exporters must render from
`buildReport` so they never diverge.
ExcelJS is dynamically imported; keep it out of any statically-loaded module. The export must stay
usable as a standalone spreadsheet (it's the reconciliation view at the office,
where phones are banned).

## PWA behavior

`registerType: 'autoUpdate'` (`vite.config.ts`) lets a new service worker take
over silently once installed, but a tab already open has no way to know — it
keeps running the old JS in memory until fully closed and relaunched.
`UpdateToast` (mounted once in `App.tsx`, above the tab content) surfaces that
moment via `vite-plugin-pwa`'s `useRegisterSW()` hook (through the
`pwaRegister.ts` indirection, see above): a "Update available" banner with a
Reload button when `needRefresh`, or a "Ready to work offline" confirmation
when `offlineReady` — both dismissible, neither auto-hides. `HelpView` (the
`Help` tab) is the install-instructions + FAQ screen; keep its FAQ answers in
sync with the "Domain invariants" section above when either changes — there's
no automated check for drift between them.

## Deployment

Static host with HTTPS (GitHub Pages or Netlify). `vite.config.ts` `base`
defaults to `/dts-expense-tracker/` for GitHub Pages; set `VITE_BASE=/` for a
root deploy (Netlify/custom domain). The PWA must work offline after first load.

The app icon (a hedgehog) is generated by `npm run gen-icons`
(`scripts/gen-icons.mjs`): a hand-authored SVG, rasterized at each manifest
size with Playwright/headless Chromium (already a devDependency for the
`verifier-gui` skill) since there's no dependency-free way to rasterize
arbitrary vector art. Run `npx playwright install chromium` once per machine
first. The maskable variant (`pwa-512x512-maskable.png`) is a **separate**
asset from the "any" icons — its artwork is shrunk into a safe zone since OS
icon masks clip anything near the edges; never point `purpose: 'maskable'` at
the same file as a plain icon.

## Roadmap

MVP (this scaffold) is Phase 1. Phases 2–3 in `SPEC.md` are done: DTS
reconciliation (check-off, mismatch flags, `.xlsx` export), multi-trip +
backup/restore + MILEAGE calculator + PWA install/offline polish (icon,
update toast, Help/FAQ tab). Phase 4 — receipt photos and interactive laptop
import — is not started. Don't pull that work forward without being asked.
