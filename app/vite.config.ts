import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El entorno (local, preview, production) se elige con CLOUDFLARE_ENV en el build:
// el plugin de Cloudflare genera la configuración de despliegue de ese entorno en dist/.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: { port: 5173 },
});
