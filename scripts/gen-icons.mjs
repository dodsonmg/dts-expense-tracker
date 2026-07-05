// Generates the app icon (a hedgehog) as PNGs at every size the PWA manifest
// needs, plus the SVG favicon. Rasterizing hand-authored vector art needs a
// real renderer, so this uses Playwright/headless Chromium — already a
// devDependency for the project's `verifier-gui` skill — rather than staying
// dependency-free like the old placeholder encoder it replaces.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const BG = '#1f2933'; // matches --bg
const BODY = '#a56a3a';
const SPINE_A = '#6b4423';
const SPINE_B = '#7a4e28';
const CREAM = '#e8cda3';
const DARK = '#2a1a10';

// Body ellipse the spines fan out from.
const CX = 46, CY = 60, RX = 30, RY = 23;
const SPINE_COUNT = 13;
const SPINE_START_DEG = 195, SPINE_END_DEG = 350; // arc across the back
const SPINE_LEN = 13;
const SPINE_HALF_WIDTH = 3.2;

function ellipsePoint(deg) {
  const t = (deg * Math.PI) / 180;
  return { x: CX + RX * Math.cos(t), y: CY + RY * Math.sin(t) };
}

// Outward unit normal/tangent at angle `deg` on the body ellipse, used to
// place each spine's base (tangent-offset) and tip (normal-extended).
function normal(deg) {
  const t = (deg * Math.PI) / 180;
  const nx = Math.cos(t) / RX;
  const ny = Math.sin(t) / RY;
  const len = Math.hypot(nx, ny);
  return { x: nx / len, y: ny / len };
}

function spines() {
  const parts = [];
  for (let i = 0; i < SPINE_COUNT; i++) {
    const deg = SPINE_START_DEG + ((SPINE_END_DEG - SPINE_START_DEG) * i) / (SPINE_COUNT - 1);
    const base = ellipsePoint(deg);
    const n = normal(deg);
    const tan = { x: -n.y, y: n.x };
    const tip = { x: base.x + n.x * SPINE_LEN, y: base.y + n.y * SPINE_LEN };
    const baseA = { x: base.x + tan.x * SPINE_HALF_WIDTH, y: base.y + tan.y * SPINE_HALF_WIDTH };
    const baseB = { x: base.x - tan.x * SPINE_HALF_WIDTH, y: base.y - tan.y * SPINE_HALF_WIDTH };
    const fill = i % 2 === 0 ? SPINE_A : SPINE_B;
    parts.push(
      `<polygon points="${baseA.x.toFixed(1)},${baseA.y.toFixed(1)} ${baseB.x.toFixed(1)},${baseB.y.toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)}" fill="${fill}" />`,
    );
  }
  return parts.join('\n  ');
}

// The hedgehog, in a 100x100 viewBox, as a <g> so callers can transform it
// (the maskable variant needs to shrink it into the safe zone).
const hedgehogGroup = `<g>
  <ellipse cx="30" cy="86" rx="6" ry="4" fill="${CREAM}" />
  <ellipse cx="48" cy="88" rx="6" ry="4" fill="${CREAM}" />
  <ellipse cx="66" cy="85" rx="6" ry="4" fill="${CREAM}" />
  <ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}" fill="${BODY}" />
  <path d="M 72,58 Q 90,55 92,63 Q 90,70 72,68 Z" fill="${CREAM}" />
  <circle cx="90" cy="62" r="2.6" fill="${DARK}" />
  <circle cx="70" cy="49" r="2.3" fill="${DARK}" />
  ${spines()}
</g>`;

// "any" purpose: rounded corners, hedgehog at its natural scale/position.
// Used for favicon.svg, pwa-*.png, and apple-touch-icon (iOS applies its own
// corner mask, but traditionally apple-touch-icon art still fills the frame).
function svgAny(rounded) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 18 : 0}" fill="${BG}" />
  ${hedgehogGroup}
</svg>
`;
}

// "maskable" purpose: OS icon masks clip anything outside a centered ~80%
// safe zone, so the hedgehog is shrunk and recentered; background fills
// edge-to-edge with no rounding (the mask supplies the shape).
function svgMaskable() {
  const bboxCx = 48.4, bboxCy = 58; // approximate hedgehog bounding-box center
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}" />
  <g transform="translate(50 50) scale(0.72) translate(${-bboxCx} ${-bboxCy})">
    ${hedgehogGroup}
  </g>
</svg>
`;
}

const svgFaviconAndAny = svgAny(true);
const svgApple = svgAny(false);
const svgMask = svgMaskable();

writeFileSync(join(publicDir, 'favicon.svg'), svgFaviconAndAny);

const browser = await chromium.launch();
const page = await browser.newPage();

async function rasterize(svg, size, outFile) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  const buf = await page.locator('svg').screenshot({ omitBackground: false });
  writeFileSync(join(publicDir, outFile), buf);
}

await rasterize(svgFaviconAndAny, 192, 'pwa-192x192.png');
await rasterize(svgFaviconAndAny, 512, 'pwa-512x512.png');
await rasterize(svgMask, 512, 'pwa-512x512-maskable.png');
await rasterize(svgApple, 180, 'apple-touch-icon.png');

await browser.close();

console.log(
  'Wrote favicon.svg, pwa-192x192.png, pwa-512x512.png, pwa-512x512-maskable.png, apple-touch-icon.png',
);
