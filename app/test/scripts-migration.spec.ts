// Fase 6: los scripts de purga y de comprobación, tal cual, contra la D1 del runtime (claves foráneas activas).
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { genererImport, versSql, type ExportV1 } from '../shared/import-v1';
import exportBrut from './fixtures/export-v1-synthetique.json';

const exportV1 = exportBrut as unknown as ExportV1;

// Como `wrangler d1 execute --file`: sin comentarios, una sentencia por «;», todo en una transacción.
function sentencias(sql: string): D1PreparedStatement[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => env.DB.prepare(s));
}

async function importer(): Promise<void> {
  const { requetes } = genererImport(exportV1, {
    pinHash: 'ab'.repeat(32),
    pinSalt: 'cd'.repeat(16),
    maintenant: '2026-12-01T00:00:00.000Z',
  });
  await env.DB.batch(sentencias(versSql(requetes)));
}

async function comptes(): Promise<Record<string, number>> {
  const verif = sentencias(env.TEST_SQL_VERIF);
  expect(verif).toHaveLength(1);
  const { results } = await verif[0]!.all<{ tabla: string; n: number }>();
  return Object.fromEntries(results.map((r) => [r.tabla, r.n]));
}

describe('scripts de migración', () => {
  it('purga los datos de prueba aunque el teléfono esté ligado a la vendedora, y deja importar de nuevo', async () => {
    await importer();
    // El teléfono del ensayo: emparejado y ligado a la vendedora tras su PIN, con un intento de PIN registrado.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO devices (id, nom, token_hash, vendeur_id) VALUES ('dev_tel', 'Téléphone', 'x', 'vend_1')",
      ),
      env.DB.prepare(
        "INSERT INTO auth_tentatives (cle, essais, fenetre_debut) VALUES ('pin:dev_tel:vend_1', 1, '2026-09-28T00:00:00.000Z')",
      ),
    ]);
    expect((await comptes()).ventes).toBe(6);

    await env.DB.batch(sentencias(env.TEST_SQL_PURGE));

    const apres = await comptes();
    const { 'devices (teléfonos)': telephones, ...donnees } = apres;
    expect(Object.keys(donnees)).toHaveLength(18);
    for (const [table, n] of Object.entries(donnees)) expect(n, table).toBe(0);
    // Solo queda el teléfono, desligado; el dispositivo del servidor se va con los datos.
    expect(telephones).toBe(1);
    const tel = await env.DB.prepare('SELECT id, vendeur_id FROM devices').first();
    expect(tel).toEqual({ id: 'dev_tel', vendeur_id: null });

    await importer();
    const reimport = await comptes();
    expect(reimport).toMatchObject({ articles: 4, ventes: 6, vendeurs: 1, 'devices (teléfonos)': 2 });
  });
});
