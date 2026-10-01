// D1 admite 100 parámetros ligados por sentencia: con más de 100 jornadas, el panel, el CSV y el bootstrap
// deben seguir respondiendo (las listas IN (...) se leen por lotes).
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { Bootstrap } from '../shared/api';

const URL = 'http://localhost';

async function appairer(): Promise<string> {
  const { code } = await (await SELF.fetch(`${URL}/api/admin/pairing`, { method: 'POST' })).json<{ code: string }>();
  const r = await SELF.fetch(`${URL}/api/devices/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, nom: 'Téléphone' }),
  });
  return (await r.json<{ token: string }>()).token;
}

describe('más de 100 jornadas', () => {
  it('KPIs, CSV de ventas y bootstrap responden', async () => {
    // El primer bootstrap siembra el catálogo y la vendedora por defecto.
    const token = await appairer();
    const bootstrap = () => SELF.fetch(`${URL}/api/bootstrap`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await bootstrap()).status).toBe(200);

    const maintenant = Date.now();
    const jours = Array.from({ length: 130 }, (_, i) => {
      // Varias jornadas por día (mañana y tarde), todas recientes: caen en la ventana del bootstrap.
      const ouverte = new Date(maintenant - i * 3 * 3600_000).toISOString();
      return { id: `jour_lim_${i}`, ouverte, mois: i < 115 ? '2031-03' : '2031-04', jour: (i % 28) + 1 };
    });
    await env.DB.batch(
      jours.flatMap((j) => [
        env.DB.prepare(
          'INSERT INTO journees (id, date_locale, lieu, vendeur_id, ouverte_at, cloturee_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(j.id, `${j.mois}-${String(j.jour).padStart(2, '0')}`, 'Gare maritime', 'vend_1', j.ouverte, j.ouverte),
        env.DB.prepare('INSERT INTO journee_fonds (journee_id, devise, montant) VALUES (?, ?, ?)').bind(
          j.id,
          'CFP',
          1000,
        ),
      ]),
    );

    const kpis = await SELF.fetch(`${URL}/api/admin/kpis?mois=2031-03`);
    expect(kpis.status).toBe(200);
    const corps = await kpis.json<{ total: { nbJournees: number }; parJournee: { id: string }[] }>();
    expect(corps.total.nbJournees).toBe(115);
    expect(corps.parJournee).toHaveLength(115);

    expect((await SELF.fetch(`${URL}/api/admin/export/ventes.csv?mois=2031-03`)).status).toBe(200);

    const b = await bootstrap();
    expect(b.status).toBe(200);
    const instantane = await b.json<Bootstrap>();
    expect(instantane.journees.length).toBeGreaterThan(100);
    expect(instantane.journees.every((j) => j.fonds.CFP === 1000)).toBe(true);
  });
});
