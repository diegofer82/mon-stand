import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

export function baseDe(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Base = ReturnType<typeof baseDe>;
export { schema };
