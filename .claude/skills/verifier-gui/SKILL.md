---
name: verifier-gui
description: This project's GUI verifier for the /verify skill — drives the DTS Expense Tracker in a real browser (Playwright) to visually confirm a UI change, beyond what vitest/RTL asserts.
---

The generic `/verify` skill looks for a `verifier-*` skill matching the
surface before cold-starting; this is that skill for this repo's surface
(browser/GUI — it's a PWA with no CLI or server API). It's a **manual
verification recipe**, not a test suite — it isn't wired into `npm test` or
CI. Reach for it when a change touches rendering/styling that component tests
(jsdom) can assert structurally (class names, text) but can't show you
visually — e.g. color precedence between two highlight states, layout, or the
real download flow for CSV/`.xlsx` exports.

## One-time setup

```bash
npx playwright install chromium   # ~100MB, cached per-machine, only needed once
```

`playwright` is a devDependency (added for this purpose only — not imported
by any app or test code), so `npm ci` already pulls the package; only the
browser binary needs the explicit install above.

## Drive it

```bash
npm run dev -- --port 5183   # note the printed base path, e.g. /dts-expense-tracker/
```

Write a throwaway script at the **repo root** (not `/tmp` — it needs
`node_modules` resolution) and run it with plain `node`, e.g.
`node verify-scratch.mjs`. Delete it before committing anything — it's
scratch, not a fixture.

```js
import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/dts-expense-tracker/'; // match the dev server's base path

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } }); // iPhone-ish width; this is a mobile PWA
await page.goto(BASE);
await page.evaluate(() => localStorage.clear()); // fresh trip, no leftover IndexedDB/localForage state
await page.reload();
```

Key selectors (all accessible-name based; the tab bar's icon glyphs are
`aria-hidden`, so the button's name is just the label):

- Tabs: `page.getByRole('button', { name: 'Entry', exact: true })` — same
  pattern for `List`, `M&IE`, `Totals`, `Export`, `Help`.
- Help tab: static content, no live data — `getByText('Install on your
  iPhone')`, FAQ items are native `<details>`/`<summary>`
  (`page.locator('details').count()`, click the `summary` text to expand).
- Entry form: `getByLabel('GBP (receipt)')`, `getByLabel('USD (DTS)')`,
  category via `page.locator('select')` + `.selectOption('TRANSPORT')`,
  payment via `page.locator('.toggle__opt', { hasText: 'Personal' }).click()`.
  Save with `getByRole('button', { name: 'Save & view list' })`.
- MILEAGE category: selecting it swaps the GBP/USD fields for
  `getByLabel('Miles')` + `getByLabel(/Rate/i)` (a calculator, on by
  default) and shows a `getByRole('button', { name: 'Enter USD manually
  instead' })` toggle — click it to get plain GBP/USD fields back (the
  toggle's label flips to `'Use miles × rate calculator instead'`). Applies
  the same way in `ExpenseList`'s `EditRow`. The List row shows a
  `"<miles> mi @ $<rate>/mi"` sub-line (e.g. `42.0 mi @ $0.670/mi`) only when
  the row has stored miles/rate — a manually-entered mileage row has none.
- Totals inputs: `getByLabel('DTS USD total for LODGING')`,
  `getByLabel('DTS USD reimbursement for GTCC')` (also `Personal`).
- Recon row state: `page.$$eval('.recon__row', els => els.map(el =>
  ({ text: el.textContent, className: el.className })))` — cheapest way to
  confirm which highlight class (`recon__row--mismatch`,
  `recon__row--incomplete`, etc.) actually won, and read off the rendered
  text in one shot.
- Screenshot: `page.screenshot({ path: '/tmp/whatever.png', fullPage: true })`,
  then `Read` the PNG to eyeball it.

## Exports

`ExportView`'s download buttons use `<a download>` + an object URL — capture
them with Playwright's download event, not by inspecting the DOM:

```js
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Download CSV' }).click(), // or 'Download .xlsx'
]);
const buf = fs.readFileSync(await download.path());
```

CSV is readable directly (`buf.toString('utf8')`); for `.xlsx`, load it with
`exceljs` (already a project dependency) the same way `xlsx.test.ts`'s
`readBack` helper does.

## Backup / restore

Also on the Export tab, below the CSV/xlsx buttons, in a "Backup" card:
`getByRole('button', { name: 'Download backup (JSON)' })` (same download-event
capture as above; it's JSON, readable directly) and `getByRole('button', {
name: 'Restore from backup…' })`, which just clicks a hidden `input[type=file]`
— set the file directly rather than clicking the button:
`page.locator('input[type="file"]').setInputFiles(path)`. That shows a
confirmation card (`text=/This will replace every trip on this device/`)
summarizing every trip in the backup (name + expense count each); only
`getByRole('button', { name: 'Replace all data' })` actually calls
`onRestore`, `getByRole('button', { name: 'Cancel' })` discards it. An invalid
file shows an inline error (e.g. `text=/Not a valid JSON file/`) and never
renders the confirmation card. The backup covers **every trip on the
device**, not just the active one — restoring replaces the whole trip list.

## Trip switcher

Header control, next to the `<h1>`: `getByRole('button', { name: /^Trip:/ })`
opens an inline panel (a `.card`, not a portal/modal) listing every trip.
Within it: `getByRole('button', { name: '<trip name>' })` selects that trip
and closes the panel; each row also has `getByRole('button', { name: 'Rename'
})` (swaps to a text input + `Save`/`Cancel`) and `getByRole('button', { name:
'Delete' })` (shows a nested confirm card, `text=/can't be undone/`, before
actually calling delete) — `Delete` is `disabled` when only one trip exists.
`getByRole('button', { name: '＋ New trip' })` reveals a text input +
`Create`. A fresh `localStorage.clear()` + reload (this skill's standard
bootstrap) still yields exactly one auto-created default trip (e.g. "Trip
1"), so existing single-trip verification flows don't need to change their
assumptions about initial state.

## PWA update/offline-ready toast

`UpdateToast` (mounted in `App.tsx`, above the tab content) only fires for
real off the `virtual:pwa-register/react` hook — dev mode's service worker
behaves differently from a production build, so drive this against
`npm run preview` (build first), not `npm run dev`. The offline-ready toast
reliably fires ~1s after first load once the SW registers; there's no easy
way to trigger the update-available path locally without two real deploys
(different build hashes), so that side is best verified by code review plus
confirming the toast renders/dismisses correctly for whichever state you can
trigger. Text: `'Ready to work offline.'` / `'Update available.'`, dismiss
button `getByRole('button', { name: 'Dismiss' })`.

## Icon changes

The app icon (`scripts/gen-icons.mjs`) is regenerated with `npm run gen-icons`
— rerun it after touching the icon, then eyeball `public/pwa-512x512.png` and
`public/pwa-512x512-maskable.png` directly (`Read` the PNG). To sanity-check
the maskable variant's safe-zone padding, clip it to a circle/hexagon in a
throwaway HTML page (`clip-path` or a rounded `overflow:hidden` div) and
screenshot — don't trust the safe-zone math unverified.

## Cleanup

- Kill the dev server (`pkill -f "vite --port 5183"` or just Ctrl-C the
  foreground job).
- Delete the scratch script — it's not a fixture, don't commit it.
- Fill colors are intentionally not asserted in vitest (see `xlsx.test.ts`
  comment) — this recipe is the only way those actually get eyeballed, so
  don't skip it for changes that touch `pendingFill`/`mismatchFill`/CSS.
