# DTS Expense Tracker — Specification

A personal, offline-first tool to (1) capture and classify expenses during a trip
from an iPhone, and (2) reconcile those expenses against the DTS
(Defense Travel System) reimbursement system, checking category totals and the
GTCC-vs-personal split.

## Context & constraints

- **Capture device:** iPhone. Installable PWA ("Add to Home Screen"), fully usable
  offline (no signal during travel).
- **Reconciliation happens in two venues, weighted equally:**
  - **Office:** phone not allowed; locked-down government workstation; can email a
    spreadsheet to a government email address and view it beside DTS. → the
    **exported file** is the reconciliation view here.
  - **Home:** personal phone/laptop available. → the **app itself** is the
    reconciliation view here.
- **Implication:** the app must work well both as a live app and as an exported
  spreadsheet. Export is a first-class feature.
- **No backend.** Data lives on the phone (IndexedDB). Nothing leaves the device
  except the CSV/spreadsheet the user chooses to email. No accounts, no sync.
- Because data is local to the phone, it does not automatically appear on the home
  laptop. That is acceptable: office uses the emailed file; home reconciles on the
  phone. Interactive laptop reconciliation (file import) is deferred to Phase 4.

## Currency model (OCONUS, no conversion)

Each itemized expense carries **two amount fields, both optional**:

- `amount_gbp` — entered at time of purchase; matches the uploaded receipt.
- `amount_usd` — backfilled later when the charge lands on the credit card;
  matches what is typed into DTS.

No automatic conversion. Seeing GBP and USD side by side lets the user match a
GBP receipt to a USD DTS entry. An expense with a GBP amount but no USD amount is
**"USD pending"** (still outstanding on the card statement) and must be surfaced as
a filter/flag.

Totals **never mix currencies**: every totals table shows separate GBP and USD
columns/blocks that are never summed together.

## Categories (fixed set, fixed order)

1. COM CARRIER
2. GTCC (FEES)
3. LODGING
4. M&IE
5. MILEAGE
6. TRANSPORT
7. OTHER

## Data model

### Itemized expense
Applies to all categories EXCEPT M&IE.

| field         | notes                                                            |
|---------------|------------------------------------------------------------------|
| `id`          | generated                                                        |
| `date`        | defaults to today on entry; **freely editable** (e.g. foreign transaction fees are dated to the purchase day even though they appear later) |
| `category`    | one of the fixed categories except M&IE                          |
| `amount_gbp`  | optional                                                         |
| `amount_usd`  | optional; backfilled when it hits the card                       |
| `payment`     | `GTCC` or `personal`                                             |
| `note`        | optional (vendor / receipt reference)                            |

### M&IE (per-diem calculator, not receipts)
M&IE is a computed allowance, **USD only**, and always contributes to the
**Personal** account bucket (never GTCC).

Composed of one or more **location segments**:

| field          | notes                          |
|----------------|--------------------------------|
| `location`     | label only; not used in math   |
| `full_rate`    | USD full-day rate              |
| `partial_rate` | USD partial-day rate           |
| `full_days`    | count                          |
| `partial_days` | count                          |

**M&IE total** =
`Σ over all segments of (full_rate × full_days + partial_rate × partial_days)`

The `location` field is a per-segment label for readability; it does not enter the
summation. The total chains across every segment.

### MILEAGE
Stays a normal itemized expense — unlike M&IE, DTS shows each mileage leg as
its own line, so each leg needs to remain an individually comparable row
(editable, "entered in DTS" toggle, shows in the List) rather than a single
computed total. Selecting MILEAGE defaults the itemized form to a **miles ×
rate calculator**: `amount_usd` is derived from `miles` and `rate` (USD/mile)
at entry/edit time, but stays independently editable afterward. The rate
persists across saves (usually one rate per trip); miles resets per entry. A
toggle switches to manual USD/GBP entry and back, for the rare case the
calculator doesn't fit (e.g. a lump mileage reimbursement already known).
Still uses its own GTCC/personal toggle, same as before.

## Totals / reconciliation view

Two tables, GBP and USD kept separate throughout:

1. **By category** — rows in the fixed category order above; used to check against
   the totals DTS shows. M&IE row is fed from the per-diem calculator (USD).
2. **By account** — GTCC vs Personal, used to verify the split disbursement
   (GTCC charges repay the card; out-of-pocket goes to the bank).
   **M&IE always counts toward Personal.**

## Screens (MVP)

1. **Entry** — form with tap dropdowns for category/payment, GBP and USD fields
   side by side, editable date defaulting to today. Optimized for fast repeated
   entry.
2. **List** — all expenses for the trip; editable/deletable; "USD pending" filter.
3. **M&IE** — segment table with a running M&IE total.
4. **Totals** — by category and by account, GBP/USD separate, M&IE folded in (USD,
   Personal).
5. **Export** — one tap → CSV (raw rows + totals block) to email to self.
6. **Help** — static install steps + FAQ; the only screen with no live trip data.

## Tech stack

- **Vite + React + TypeScript.**
- Local persistence in **IndexedDB** (via localForage).
- **CSV export** hand-rolled (no dependency) for MVP.
- **`.xlsx` export via ExcelJS** (Phase 2) — chosen over SheetJS because
  SheetJS's free tier can't style cells, and highlighting mismatches is the
  point of the office view. Lazy-loaded (dynamic import) to keep initial load
  lean; precached for offline export.
- **PWA** install via `vite-plugin-pwa`; must work offline after first load.
- **Hosting:** free static host with HTTPS (Netlify or GitHub Pages) so the iPhone
  can install it and run offline. No backend.

## Phased plan

**MVP**
1. Itemized expense entry (date default+editable, category, GBP, USD, GTCC/personal, note).
2. M&IE per-diem calculator (multi-segment, USD, → Personal).
3. Live totals by category and by account, GBP/USD separate.
4. CSV export to email; local persistence; "USD pending" filter.

> **Status:** MVP and Phase 2 are implemented and deployed. Two decisions
> refined the plan below during build:
> - Reconciliation is **USD-only** (DTS reports USD), so item 6's "per currency"
>   intent is realized as USD-to-USD checks; it also covers **account**
>   reimbursement, not just categories.
> - Item 7 uses **ExcelJS**, not SheetJS (see Tech stack).
> - A category/account total whose USD is fed by a **USD-pending** expense is
>   flagged **incomplete** (yellow), distinct from a **mismatch** (red) — the
>   DTS comparison is premature while data's still missing. Surfaced on the
>   Totals tab, the `.xlsx` (Reconcile + Expenses sheets), and the CSV
>   (`usd_incomplete` column).

**Phase 2 — reconciliation**
5. Check off each item as "entered in DTS."
6. Enter DTS's shown category *and account* totals (USD); app flags mismatches.
7. Formatted `.xlsx` export (ExcelJS) with the reconciliation tables pre-built
   at the top; the CSV export also carries the DTS comparison columns.

**Phase 3 — multi-trip + robustness**
8. Multiple trips; per-trip export.
9. ~~PWA install/offline polish.~~ **Done** — app icon (hedgehog, replacing the
   placeholder), an update-available/offline-ready toast (`registerType:
   'autoUpdate'` was previously silent — a tab already open had no way to know
   an update had shipped), and a Help tab (install steps + FAQ covering the
   domain concepts above). iOS meta tags and the manifest were already solid.
10. ~~Backup/restore all data as a file.~~ **Done** — a single JSON file
    (all expenses, M&IE segments, DTS totals) via `lib/backup.ts`, surfaced on
    the Export tab. Restore is **replace-only**, not merge: there's no
    multi-trip yet (item 8, still open) and the DTS-expected fields are
    per-category/account singletons with no sensible merge rule, so restore
    means "make this device match the backup," same as restoring a phone.
    Requires an explicit confirmation step (summary of what will be replaced)
    before committing.
11. ~~Optional MILEAGE calculator (miles × rate).~~ **Done** — see § MILEAGE.
    MILEAGE stayed itemized (not M&IE-style) so each leg is still individually
    comparable against DTS; the calculator is an input convenience only.

**Phase 4 — nice-to-haves**
12. Receipt photos.
13. Interactive laptop reconciliation via file import / self-contained HTML export.
