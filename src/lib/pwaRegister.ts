// Indirection so UpdateToast.test.tsx can mock this (a normal, resolvable
// file path) instead of the literal 'virtual:pwa-register/react' specifier —
// vitest.config.ts doesn't run the VitePWA plugin, so Vite can't resolve that
// specifier at all during tests, even with vi.mock targeting it directly.
export { useRegisterSW } from 'virtual:pwa-register/react';
