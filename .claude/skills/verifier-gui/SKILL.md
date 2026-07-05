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
  pattern for `List`, `M&IE`, `Totals`, `Export`.
- Entry form: `getByLabel('GBP (receipt)')`, `getByLabel('USD (DTS)')`,
  category via `page.locator('select')` + `.selectOption('TRANSPORT')`,
  payment via `page.locator('.toggle__opt', { hasText: 'Personal' }).click()`.
  Save with `getByRole('button', { name: 'Save & view list' })`.
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

## Cleanup

- Kill the dev server (`pkill -f "vite --port 5183"` or just Ctrl-C the
  foreground job).
- Delete the scratch script — it's not a fixture, don't commit it.
- Fill colors are intentionally not asserted in vitest (see `xlsx.test.ts`
  comment) — this recipe is the only way those actually get eyeballed, so
  don't skip it for changes that touch `pendingFill`/`mismatchFill`/CSS.
