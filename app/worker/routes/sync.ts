// Sincronización: push de las operaciones del outbox (idempotente por op_id) y pull de las de los demás
// dispositivos desde un cursor.
import { and, asc, eq, gt, ne } from 'drizzle-orm';
import { Hono } from 'hono';

import { syncRequeteSchema, type SyncReponse } from '../../shared/api';
import { opSchema, type Op } from '../../shared/ops';
import { erreur, type AppEnv } from '../auth';
import { schema } from '../db';
import { appliquerOpD1, cursorActuel, dejaAppliquee } from '../sync/appliquer';

export const sync = new Hono<AppEnv>();

const PAGE_PULL = 300;

sync.post('/', async (c) => {
  const corps = syncRequeteSchema.safeParse(await c.req.json().catch(() => null));
  if (!corps.success)
    return erreur(c, 400, 'requete_invalide', 'Requête de synchronisation invalide', corps.error.issues.slice(0, 5));
  const db = c.get('db');
  const appareil = c.get('appareil');

  const acceptes: string[] = [];
  const refuses: { opId: string; erreur: string }[] = [];
  for (const op of corps.data.ops) {
    if (op.deviceId !== appareil.id) {
      refuses.push({ opId: op.opId, erreur: 'Opération d’un autre appareil' });
      continue;
    }
    try {
      if (!(await dejaAppliquee(db, op.opId))) await appliquerOpD1(db, op);
      acceptes.push(op.opId);
    } catch (e) {
      console.error('sync: opération refusée', op.type, op.opId, e);
      refuses.push({ opId: op.opId, erreur: e instanceof Error ? e.message : 'Erreur inconnue' });
    }
  }

  const rows = await db
    .select({ seq: schema.syncJournal.seq, payload: schema.syncJournal.payload })
    .from(schema.syncJournal)
    .where(and(gt(schema.syncJournal.seq, corps.data.cursor), ne(schema.syncJournal.deviceId, appareil.id)))
    .orderBy(asc(schema.syncJournal.seq))
    .limit(PAGE_PULL + 1);
  const encore = rows.length > PAGE_PULL;
  const page = rows.slice(0, PAGE_PULL);
  const ops: Op[] = [];
  for (const r of page) {
    const parsed = opSchema.safeParse(JSON.parse(r.payload));
    if (parsed.success) ops.push(parsed.data);
  }
  const cursor = encore ? (page[page.length - 1]?.seq ?? corps.data.cursor) : await cursorActuel(db);

  await db
    .update(schema.devices)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(schema.devices.id, appareil.id));

  const reponse: SyncReponse = { acceptes, refuses, ops, cursor: Math.max(cursor, corps.data.cursor), encore };
  return c.json(reponse);
});
