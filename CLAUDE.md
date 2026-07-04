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
npm run gen-icons  # regenerate placeholder PWA icons in public/
```

There is no test runner or linter configured yet.

## Stack

- **Vite + React 19 + TypeScript** (strict).
- **localForage** over IndexedDB for persistence (`src/db.ts`).
- **vite-plugin-pwa** (`registerType: 'autoUpdate'`) for install + offline.
- CSV export is hand-rolled, no dependency (`src/lib/csv.ts`).

## Architecture

- `src/types.ts` — domain types + the fixed `CATEGORIES` list/order, plus
  `isUsdPending`. Single source of truth for the data model.
- `src/db.ts` — IndexedDB load/save for expenses, M&IE segments, and DTS-expected
  totals.
- `src/useTripData.ts` — the one stateful hook: loads once, mirrors state to
  IndexedDB, exposes add/update/delete for expenses and segments plus
  `setDtsExpected`. `App` owns it and passes slices down; components are
  otherwise presentational.
- `src/lib/` — pure functions, no React:
  - `mie.ts` — M&IE per-diem math.
  - `totals.ts` — by-category and by-account totals.
  - `reconcile.ts` — compares app totals against DTS-entered totals (USD).
  - `report.ts` — one structured export model consumed by both exporters, so
    CSV and XLSX never drift.
  - `csv.ts` — CSV export document.
  - `xlsx.ts` — formatted `.xlsx` (ExcelJS, dynamically imported to stay out of
    the main bundle).
  - `format.ts` — currency + date helpers.
- `src/components/` — one file per screen: `EntryForm`, `ExpenseList`,
  `MieView`, `TotalsView`, `ExportView`. `App.tsx` is the tab shell.

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

## Export contract

`buildCsv` emits one file: `EXPENSES` rows (with `usd_pending` and
`entered_in_dts` flag columns), then `M&IE SEGMENTS`, then `TOTALS BY CATEGORY`,
then `TOTALS BY ACCOUNT`. The two totals blocks carry the DTS comparison
(`dts_usd`, `delta_usd`, `status` where status is `MISMATCH` / `ok` / blank) and
a `usd_incomplete` (`yes`/blank) flag, so the emailed sheet works as the
office's reconciliation view. Money cells are plain 2-dp numbers (or blank) —
no currency glyphs — because the office workstation reconciles the sheet
numerically against DTS.

The formatted `.xlsx` (`buildXlsx`, ExcelJS) renders from the same `report.ts`
model: a **Reconcile** sheet with the by-category and by-account tables at the
top (mismatch rows red, USD-incomplete rows yellow — incomplete wins when
both apply), then **Expenses** (raw rows, USD-pending rows yellow) and **M&IE**
sheets. Both exporters must render from `buildReport` so they never diverge.
ExcelJS is dynamically imported; keep it out of any statically-loaded module. The export must stay
usable as a standalone spreadsheet (it's the reconciliation view at the office,
where phones are banned).

## Deployment

Static host with HTTPS (GitHub Pages or Netlify). `vite.config.ts` `base`
defaults to `/dts-expense-tracker/` for GitHub Pages; set `VITE_BASE=/` for a
root deploy (Netlify/custom domain). The PWA must work offline after first load.

Placeholder PWA icons are generated by `npm run gen-icons` (a tiny dependency-
free PNG encoder in `scripts/`). Replace with real artwork before shipping.

## Roadmap

MVP (this scaffold) is Phase 1. Phases 2–4 in `SPEC.md`: DTS reconciliation
(check-off, mismatch flags, `.xlsx` export), multi-trip + backup/restore, then
receipt photos and interactive laptop import. Don't pull that work forward
without being asked.
