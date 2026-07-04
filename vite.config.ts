import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo>/. Override with VITE_BASE for a custom
// domain or Netlify (where base should be '/').
const base = process.env.VITE_BASE ?? '/dts-expense-tracker/';

export default defineConfig({
  base,
  build: {
    // ExcelJS is a deliberately code-split, lazy-loaded chunk (~270 kB gzip),
    // loaded only when the user exports. Raise the advisory warning threshold.
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'DTS Expense Tracker',
        short_name: 'DTS Expenses',
        description:
          'Offline-first tool to capture trip expenses and reconcile them against DTS.',
        theme_color: '#1f2933',
        background_color: '#1f2933',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
});
