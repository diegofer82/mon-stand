import { readFileSync } from 'node:fs';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// El entorno (local o production) se elige con CLOUDFLARE_ENV en el build:
// el plugin de Cloudflare genera la configuración de despliegue de ese entorno en dist/.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mon Stand — Debajah Création',
        short_name: 'Mon Stand',
        description: 'Caisse du stand : ventes multi-devises, stock, heures et clôture du jour.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f1f8',
        theme_color: '#1f0f3d',
        categories: ['business', 'finance'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La app entera se precarga: sin red, todo sigue funcionando. La API no se cachea (los datos viven en IndexedDB).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // /admin y /cdn-cgi/ (retorno del login de Cloudflare Access) van siempre a la red: si el service worker
        // respondiera con la app, Access no podría pedir la sesión ni dejar su cookie.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/, /^\/cdn-cgi\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
    cloudflare(),
  ],
  server: { port: 5173 },
});
