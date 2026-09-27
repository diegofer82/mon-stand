import { Hono } from 'hono';

import { dateMetier, FUSEAU_METIER, heureMetier } from '../shared/dates';
import { archiverMois, moisPrecedent } from './archive';
import { authAdmin, authAppareil, avecBase, erreur, type AppEnv } from './auth';
import { baseDe } from './db';
import { admin } from './routes/admin';
import { appareils } from './routes/appareils';
import { auth } from './routes/auth';
import { bootstrap } from './routes/bootstrap';
import { sync } from './routes/sync';
import { actualiserTaux } from './taux';

type EtatBase =
  { ok: true; migration: string | null; tables: number; latenceMs: number } | { ok: false; erreur: string };

const app = new Hono<AppEnv>();

app.onError((e, c) => {
  console.error('api: erreur non gérée', c.req.method, c.req.path, e);
  return erreur(c, 500, 'interne', 'Erreur interne');
});

// Comprueba que el Worker responde y que D1 está migrada. Sin datos sensibles: es pública.
app.get('/api/health', async (c) => {
  const base = await etatBase(c.env.DB);
  const maintenant = new Date();
  return c.json(
    {
      statut: base.ok ? 'ok' : 'degrade',
      environnement: c.env.ENVIRONMENT,
      version: c.env.APP_VERSION,
      dateMetier: dateMetier(maintenant),
      heureMetier: heureMetier(maintenant),
      fuseau: FUSEAU_METIER,
      base,
    },
    base.ok ? 200 : 503,
  );
});

app.use('/api/*', avecBase);
app.route('/api/devices', appareils);
app.use('/api/auth/*', authAppareil);
app.route('/api/auth', auth);
app.use('/api/bootstrap', authAppareil);
app.route('/api/bootstrap', bootstrap);
app.use('/api/sync', authAppareil);
app.route('/api/sync', sync);
app.use('/api/admin/*', authAdmin);
app.route('/api/admin', admin);

app.all('/api/*', (c) => c.json({ erreur: 'Route inconnue' }, 404));

async function etatBase(db: D1Database): Promise<EtatBase> {
  const debut = Date.now();
  try {
    const tables = await db
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
      )
      .first<{ n: number }>();
    const migration = await db
      .prepare('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1')
      .first<{ name: string }>();
    return { ok: true, migration: migration?.name ?? null, tables: tables?.n ?? 0, latenceMs: Date.now() - debut };
  } catch (error) {
    console.error('health: D1 inaccessible', error);
    return { ok: false, erreur: 'Base de données inaccessible' };
  }
}

/** Cron (wrangler.jsonc → triggers.crons): tasas diarias y archivo mensual. */
export function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
  const db = baseDe(env.DB);
  const tache = controller.cron === '0 20 1 * *' ? 'archive' : 'taux';
  console.log('cron', controller.cron, tache);
  if (tache === 'archive') {
    ctx.waitUntil(
      archiverMois(env, db, moisPrecedent(new Date(controller.scheduledTime)))
        .then((r) => console.log('archive', r.cle, r.lignes, 'lignes'))
        .catch((e: unknown) => console.error('archive: échec', e)),
    );
  } else {
    ctx.waitUntil(
      actualiserTaux(env, db)
        .then((t) => console.log('taux', t.date, t.source, JSON.stringify(t.taux)))
        .catch((e: unknown) => console.error('taux: échec', e)),
    );
  }
}

export default { fetch: app.fetch, scheduled };
