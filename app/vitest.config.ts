// Dos suites. La del Worker corre en el runtime real de Cloudflare contra una D1 migrada;
// la de dominio es lógica pura (importes, fechas) y corre en Node.
import { readFileSync } from 'node:fs';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('./migrations');
// Scripts de la migración (Fase 6), probados tal cual contra la D1 del runtime.
const sqlPurge = readFileSync('./scripts/purger-production.sql', 'utf8');
const sqlVerif = readFileSync('./scripts/verifier-vide.sql', 'utf8');

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: { TEST_MIGRATIONS: migrations, TEST_SQL_PURGE: sqlPurge, TEST_SQL_VERIF: sqlVerif },
            },
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
