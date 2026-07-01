import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: false, // public/manifest.json is hand-authored, served as-is
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
        // react-globe.gl (PortGlobeView) and the html2canvas/purify chunks jsPDF
        // pulls in for its unused .html() plugin are dynamic-import-only — keep
        // them out of the eager install precache, or the SW just re-downloads
        // the whole point of code-splitting them out of the initial bundle.
        // They're cached on first use instead via the runtimeCaching rule below.
        globIgnores: ['**/react-globe.gl-*.js', '**/html2canvas-*.js', '**/purify.es-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/node_modules\/@supabase\/supabase-js\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'supabase-js' },
          },
          {
            urlPattern: /\/assets\/(react-globe\.gl|html2canvas|purify\.es)-.*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-chunks',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
