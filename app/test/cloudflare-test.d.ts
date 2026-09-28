import type { D1Migration } from '@cloudflare/vitest-plugin';

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
      TEST_SQL_PURGE: string;
      TEST_SQL_VERIF: string;
    }
  }
}

export {};
