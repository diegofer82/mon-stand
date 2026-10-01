// Fase 6: el importador «export v1 → SQL» contra la D1 local, con un export sintético (el real nunca entra en el repo).
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { dateNoumea, genererImport, versSql, type ExportV1 } from '../shared/import-v1';
import exportBrut from './fixtures/export-v1-synthetique.json';

const exportV1 = exportBrut as unknown as ExportV1;

async function executer(sql: string): Promise<void> {
  // wrangler d1 execute --file: una sentencia por línea aquí.
  for (const ligne of sql.split('\n').filter((l) => l.trim())) await env.DB.prepare(ligne).run();
}

async function compter(table: string, ou = '1 = 1'): Promise<number> {
  const r = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${ou}`).first<{ n: number }>();
  return r?.n ?? 0;
}

describe('importador v1', () => {
  it('genera SQL idempotente y un informe que cuadra con los cierres', async () => {
    const { requetes, rapport } = genererImport(exportV1, {
      pinHash: 'ab'.repeat(32),
      pinSalt: 'cd'.repeat(16),
      maintenant: '2026-12-01T00:00:00.000Z',
    });
    expect(rapport.articles).toBe(4);
    expect(rapport.prixManuels).toBe(1);
    expect(rapport.ventes).toBe(6);
    expect(rapport.ventesV13Devise).toBe(1);
    expect(rapport.sessions).toBe(3);
    expect(rapport.taux).toBe(5);
    // Cierre v1.3 (sin id): la venta en AUD sin tasa se acredita al total → 3 500 CFP = totalEncaisse v1 (que sumaba 2 000 + 1 500).
    const c1 = rapport.journees.find((j) => j.id === 'jour_v1_clo_legacy_0');
    expect(c1).toMatchObject({
      date: '2026-09-06',
      nbVentes: 2,
      totalEncaisseCfp: 3500,
      totalEncaisseV1: 3500,
      ecart: 0,
    });
    // Cierre v1.5: 3 000 (TPE) + 1 844 (AUD) + 1 500 (remise à l'encaissement) = 6 344.
    const c2 = rapport.journees.find((j) => j.id === 'jour_v1_clo_1758300000000');
    expect(c2).toMatchObject({ date: '2026-09-20', totalEncaisseCfp: 6344, totalEncaisseV1: 6344, ecart: 0 });
    expect(rapport.journees.find((j) => j.id === 'jour_v1_en_cours')?.nbVentes).toBe(1);
    expect(rapport.avertissements.some((a) => a.includes('v1.3'))).toBe(true);
    expect(rapport.avertissements.some((a) => a.includes('2026-09-05 (v1) → 2026-09-06'))).toBe(true);
    expect(dateNoumea('2026-09-05T23:30:00.000Z')).toBe('2026-09-06');

    const sql = versSql(requetes);
    expect(sql).toContain('INSERT OR IGNORE INTO articles');
    expect(sql).toContain("'Boucles d''oreilles'");

    await executer(sql);
    const attendu = {
      articles: 4,
      article_prix: 1,
      categories: 3,
      vendeurs: 1,
      journees: 3,
      ventes: 6,
      vente_lignes: 6,
      vente_paiements: 6,
      stock_mouvements: 4,
      sessions_travail: 3,
      taux_historique: 5,
    };
    for (const [table, n] of Object.entries(attendu)) expect(await compter(table), table).toBe(n);
    // Repetir el import no duplica nada.
    await executer(sql);
    for (const [table, n] of Object.entries(attendu)) expect(await compter(table), table).toBe(n);

    // Verificaciones contra el export (Fase 6): stock, CA por cierre, precio manual, sesión pagada.
    const stock = await env.DB.prepare(
      "SELECT sum(delta) AS n FROM stock_mouvements WHERE article_id = 'art_boucles'",
    ).first<{ n: number }>();
    expect(stock?.n).toBe(47);
    const ca = await env.DB.prepare(
      "SELECT sum(montant_cfp) AS n FROM vente_paiements p JOIN ventes v ON v.id = p.vente_id WHERE v.journee_id = 'jour_v1_clo_1758300000000'",
    ).first<{ n: number }>();
    expect(ca?.n).toBe(6344);
    const aud = await env.DB.prepare(
      "SELECT * FROM vente_paiements WHERE vente_id = 'vte_v1_clo_1758300000000_1758283600000'",
    ).first<{ devise: string; montant_devise: number; total_devise: number; taux_cfp: number; montant_cfp: number }>();
    expect(aud).toMatchObject({
      devise: 'AUD',
      montant_devise: 50,
      total_devise: 25,
      taux_cfp: 73.77,
      montant_cfp: 1844,
    });
    expect(await compter('article_prix', "article_id = 'art_boucles' AND devise = 'AUD' AND prix = 27")).toBe(1);
    expect(await compter('sessions_travail', 'payee_at IS NOT NULL')).toBe(1);
    expect(await compter('journees', 'cloturee_at IS NULL')).toBe(1);
    const vendeur = await env.DB.prepare("SELECT prenom, taux_horaire_cfp FROM vendeurs WHERE id = 'vend_1'").first<{
      prenom: string;
      taux_horaire_cfp: number;
    }>();
    expect(vendeur).toEqual({ prenom: 'Marie', taux_horaire_cfp: 1500 });
  });

  it('un cierre v1.3 real (sin clotureAt, cerrado días después) toma la fecha de sus ventas', () => {
    const vente = exportV1.historique[0]!.ventes[0]!;
    const { requetes, rapport } = genererImport(
      {
        ...exportV1,
        ventes: [],
        historique: [
          {
            id: 'clo_legacy_3',
            date: '2026-05-16',
            nbVentes: 2,
            totalEncaisse: 0,
            // 12:45 y 17:40 en Nouméa, el 14 de mayo; el cierre se hizo el 16.
            ventes: [
              { ...vente, id: 1, ts: '2026-05-14T01:45:00.000Z' },
              { ...vente, id: 2, ts: '2026-05-14T06:40:00.000Z' },
            ],
            sessions: [],
          },
          {
            id: 'clo_legacy_4',
            date: '2026-05-20',
            nbVentes: 1,
            totalEncaisse: 0,
            // Última venta a las 17:40 de Nouméa, después del cierre supuesto de las 17:00.
            ventes: [{ ...vente, id: 3, ts: '2026-05-20T06:40:00.000Z' }],
            sessions: [],
          },
        ],
      },
      { pinHash: 'ab'.repeat(32), pinSalt: 'cd'.repeat(16), maintenant: '2026-12-01T00:00:00.000Z' },
    );
    expect(rapport.journees.map((j) => j.date)).toEqual(['2026-05-14', '2026-05-20']);
    expect(rapport.avertissements.some((a) => a.includes('2026-05-16 (v1) → 2026-05-14'))).toBe(true);
    const sql = versSql(requetes);
    expect(sql).toContain("'jour_v1_clo_legacy_3', '2026-05-14'");
    // Cierre supuesto (16 de mayo, 17:00) posterior a las ventas: se conserva; en el otro, se alinea con la última venta.
    expect(sql).toContain("'2026-05-14T01:45:00.000Z', '2026-05-16T06:00:00.000Z'");
    expect(sql).toContain("'2026-05-20T06:40:00.000Z', '2026-05-20T06:40:00.000Z'");
  });
});
