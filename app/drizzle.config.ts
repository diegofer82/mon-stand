import { defineConfig } from 'drizzle-kit';

// Drizzle solo genera el SQL de las migraciones (npm run db:generate);
// Wrangler las aplica a D1 (npm run db:migrate:*).
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/db/schema.ts',
  out: './migrations',
});
