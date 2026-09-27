import { Hono } from 'hono';

import { dateMetier, FUSEAU_METIER, heureMetier } from '../shared/dates';

type EtatBase =
  { ok: true; migration: string | null; tables: number; latenceMs: number } | { ok: false; erreur: string };

const app = new Hono<{ Bindings: Env }>();

// Comprueba que el Worker responde y que D1 está migrada. Sin datos sensibles: es pública.
app.get('/api/health', async (c) => {
  const base = await etatBase(c.env.DB);
  const maintenant = new Date();
  return c.json(
    {
      statut: base.ok ? 'ok' : 'degrade',
      environnement: c.env.ENVIRONMENT,
      dateMetier: dateMetier(maintenant),
      heureMetier: heureMetier(maintenant),
      fuseau: FUSEAU_METIER,
      base,
    },
    base.ok ? 200 : 503,
  );
});

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

export default app;
