// Dos suites. La del Worker corre en el runtime real de Cloudflare contra una D1 migrada;
// la de dominio es lógica pura (importes, fechas) y corre en Node.
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('./migrations');

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
          }),
        ],
        test: {
          name: 'worker',
          include: ['test/**/*.spec.ts'],
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        test: {
          name: 'domaine',
          include: ['shared/**/*.test.ts', 'src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
