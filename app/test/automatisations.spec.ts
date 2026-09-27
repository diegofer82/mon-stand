// Fase 5: clôture archivada en R2 al sincronizar, panel (KPIs, jornada, exportes CSV), tasas por cron, archivo mensual.
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { Bootstrap, SyncReponse } from '../shared/api';
import type { Op } from '../shared/ops';
import { baseDe } from '../worker/db';
import { actualiserTaux, CLE_KV_TAUX, type TableTauxKv } from '../worker/taux';

const URL = 'http://localhost';
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function appareil(nom: string) {
  const code = await (await SELF.fetch(`${URL}/api/admin/pairing`, { method: 'POST' })).json<{ code: string }>();
  const r = await (
    await SELF.fetch(`${URL}/api/devices/pair`, json({ code: code.code, nom }))
  ).json<{ deviceId: string; token: string }>();
  const b = await (
    await SELF.fetch(`${URL}/api/bootstrap`, { headers: { Authorization: `Bearer ${r.token}` } })
  ).json<Bootstrap>();
  const sync = async (ops: Op[], cursor = b.cursor) =>
    (
      await SELF.fetch(`${URL}/api/sync`, {
        ...json({ cursor, ops }),
        headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' },
      })
    ).json<SyncReponse>();
  return { ...r, bootstrap: b, sync };
}

function journeeComplete(deviceId: string, dateLocale: string): { ops: Op[]; journeeId: string } {
  const journeeId = `jour_${crypto.randomUUID()}`;
  const ts = `${dateLocale}T00:30:00.000Z`;
  const venteId = `vte_${crypto.randomUUID()}`;
  const base = { deviceId, vendeurId: 'vend_1' };
  const ops: Op[] = [
    {
      ...base,
      opId: crypto.randomUUID(),
      ts,
      type: 'journee.ouvrir',
      journee: {
        id: journeeId,
        dateLocale,
        lieu: 'Gare maritime',
        vendeurId: 'vend_1',
        fonds: { CFP: 1000, AUD: 100 },
        ouverteAt: ts,
        clotureeAt: null,
        commentaireCloture: null,
        pdfKey: null,
      },
    },
    {
      ...base,
      opId: crypto.randomUUID(),
      ts,
      type: 'vente.creer',
      vente: {
        id: venteId,
        journeeId,
        vendeurId: 'vend_1',
        deviceId,
        ts,
        sousTotalCfp: 2000,
        remisePanierCfp: 0,
        remiseEncaissementCfp: 156,
        totalCfp: 2000,
        annuleeAt: null,
        lignes: [
          {
            id: `lig_${crypto.randomUUID()}`,
            articleId: 'art_collier-200',
            nomSnapshot: 'Collier 200',
            qty: 1,
            prixUnitCfp: 2000,
            totalCfp: 2000,
          },
        ],
        paiements: [
          {
            id: `pai_${crypto.randomUUID()}`,
            devise: 'AUD',
            montantDevise: 50,
            totalDevise: 25,
            tauxCfp: 73.77,
            montantCfp: 1844,
            renduMontant: 25,
            renduDevise: 'AUD',
          },
        ],
      },
      mouvements: [
        {
          id: `mvt_${crypto.randomUUID()}`,
          articleId: 'art_collier-200',
          delta: -1,
          motif: 'vente',
          venteId,
          vendeurId: 'vend_1',
          deviceId,
          ts,
        },
      ],
    },
    {
      ...base,
      opId: crypto.randomUUID(),
      ts: `${dateLocale}T03:00:00.000Z`,
      type: 'session.upsert',
      session: {
        id: `ses_${crypto.randomUUID()}`,
        vendeurId: 'vend_1',
        debut: `${dateLocale}T00:00:00.000Z`,
        fin: `${dateLocale}T03:00:00.000Z`,
        dureeMin: 180,
        commentaire: null,
        payeeAt: null,
      },
    },
    {
      ...base,
      opId: crypto.randomUUID(),
      ts: `${dateLocale}T04:00:00.000Z`,
      type: 'journee.cloturer',
      journeeId,
      clotureeAt: `${dateLocale}T04:00:00.000Z`,
      commentaire: 'Belle journée',
      comptages: [{ id: `cpt_${crypto.randomUUID()}`, journeeId, devise: 'AUD', attendu: 125, compte: 120, ecart: -5 }],
    },
  ];
  return { ops, journeeId };
}

describe('clôture archivada y panel', () => {
  it('al sincronizar una clôture, el cierre queda en R2 (HTML sin navegador) y visible en el panel', async () => {
    const a = await appareil('Tel clôture');
    const { ops, journeeId } = journeeComplete(a.deviceId, '2026-10-10');
    const r = await a.sync(ops);
    expect(r.refuses).toEqual([]);
    // waitUntil: el archivo se escribe después de responder; se espera un poco.
    let cle: string | null = null;
    for (let i = 0; i < 20 && !cle; i++) {
      await new Promise((res) => setTimeout(res, 100));
      const d = await (
        await SELF.fetch(`${URL}/api/admin/journees/${journeeId}`)
      ).json<{ journee: { pdfKey: string | null } }>();
      cle = d.journee.pdfKey;
    }
    expect(cle).toBe(`local/clotures/2026/2026-10-10_${journeeId}.html`);
    const fichier = await SELF.fetch(`${URL}/api/admin/journees/${journeeId}/pdf`);
    expect(fichier.status).toBe(200);
    expect(fichier.headers.get('Content-Type')).toContain('text/html');
    const html = await fichier.text();
    expect(html).toContain('Clôture de journée');
    expect(html).toContain('1 844 CFP'); // CA
    expect(html).toContain('Belle journée');
    expect(html).toContain('3h00'); // horas del día
    expect(html).toContain('−5'); // écart AUD
  });

  it('KPIs del mes, detalle de jornada y exportes CSV', async () => {
    const a = await appareil('Tel KPI');
    const j1 = journeeComplete(a.deviceId, '2026-11-07');
    const j2 = journeeComplete(a.deviceId, '2026-11-14');
    const r = await a.sync([...j1.ops, ...j2.ops]);
    expect(r.refuses).toEqual([]);
    const kpis = await (
      await SELF.fetch(`${URL}/api/admin/kpis?mois=2026-11`)
    ).json<{
      mois: string;
      total: { nbJournees: number; nbVentes: number; totalEncaisseCfp: number };
      parJournee: { id: string; totalEncaisseCfp: number }[];
      parLieu: { lieu: string; nbJournees: number }[];
      heures: { prenom: string; totalMin: number; aPayerCfp: number }[];
    }>();
    expect(kpis.mois).toBe('2026-11');
    expect(kpis.total).toMatchObject({ nbJournees: 2, nbVentes: 2, totalEncaisseCfp: 3688 });
    expect(kpis.parLieu).toEqual([{ lieu: 'Gare maritime', nbJournees: 2, nbVentes: 2, totalEncaisseCfp: 3688 }]);
    const v = kpis.heures.find((h) => h.prenom === 'Vendeuse');
    expect(v?.totalMin).toBe(360);
    expect(v?.aPayerCfp).toBe(9000); // 6 h × 1 500

    const detail = await (
      await SELF.fetch(`${URL}/api/admin/journees/${j1.journeeId}`)
    ).json<{ ventes: unknown[]; comptages: unknown[]; resume: { nbVentes: number } }>();
    expect(detail.ventes).toHaveLength(1);
    expect(detail.comptages).toHaveLength(1);
    expect(detail.resume.nbVentes).toBe(1);

    const ventesCsv = await SELF.fetch(`${URL}/api/admin/export/ventes.csv?mois=2026-11`);
    expect(ventesCsv.headers.get('Content-Type')).toContain('text/csv');
    // text() quita el BOM al decodificar: se comprueba sobre los bytes.
    const octets = new Uint8Array(await ventesCsv.arrayBuffer());
    expect([...octets.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texte = new TextDecoder().decode(octets);
    expect(texte.startsWith('date;heure;lieu')).toBe(true);
    expect(texte.split('\r\n').filter(Boolean)).toHaveLength(3);
    expect(texte).toContain('50 AUD (rendu 25 AUD)');
    const heuresCsv = await (await SELF.fetch(`${URL}/api/admin/export/heures.csv?mois=2026-11`)).text();
    expect(heuresCsv.split('\r\n').filter(Boolean)).toHaveLength(3);
    expect(heuresCsv).toContain('3h00;1500;4500;non');

    expect((await SELF.fetch(`${URL}/api/admin/journees/inexistante`)).status).toBe(404);
  });
});

describe('tasas y archivo mensual', () => {
  it('actualiserTaux: EUR × paridad → KV, historial y una operación por divisa en el diario', async () => {
    const faux = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ base: 'EUR', rates: { AUD: 1.6176, USD: 1.1367, NZD: 2.0048, JPY: 180.5 } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )) as unknown as typeof fetch;
    const db = baseDe(env.DB);
    const table = await actualiserTaux(env, db, faux);
    expect(table.source).toBe('bce');
    expect(table.taux.AUD).toBeCloseTo(73.77, 1);
    expect(table.taux.JPY).toBeCloseTo(0.661, 2);
    const kv = await env.TAUX.get<TableTauxKv>(CLE_KV_TAUX, 'json');
    expect(kv?.taux.USD).toBeCloseTo(104.98, 1);
    // Un teléfono recibe las tasas en su siguiente pull.
    const a = await appareil('Tel taux');
    expect(a.bootstrap.taux.find((t) => t.devise === 'AUD')?.source).toBe('bce');
    const r = await a.sync([], 0);
    expect(r.ops.filter((o) => o.type === 'taux.definir').length).toBeGreaterThanOrEqual(4);
  });

  it('sin ninguna fuente, actualiserTaux falla sin tocar nada', async () => {
    const mort = (() => Promise.resolve(new Response('nope', { status: 500 }))) as unknown as typeof fetch;
    await expect(actualiserTaux(env, baseDe(env.DB), mort)).rejects.toThrow(/Aucune source/);
  });

  it('archivo mensual en R2, listado y descarga', async () => {
    const r = await SELF.fetch(`${URL}/api/admin/archives?mois=2026-10`, { method: 'POST' });
    expect(r.status).toBe(201);
    const corps = await r.json<{ cle: string; lignes: number }>();
    expect(corps.cle).toBe('local/archives/2026-10.json');
    expect(corps.lignes).toBeGreaterThan(20);
    const liste = await (await SELF.fetch(`${URL}/api/admin/archives`)).json<{ archives: { cle: string }[] }>();
    expect(liste.archives.some((a) => a.cle === corps.cle)).toBe(true);
    const fichier = await (
      await SELF.fetch(`${URL}/api/admin/archives/2026-10`)
    ).json<{ mois: string; tables: { vendeurs: { pinHash?: string }[] } }>();
    expect(fichier.mois).toBe('2026-10');
    expect(fichier.tables.vendeurs[0]?.pinHash).toBeUndefined();
    expect((await SELF.fetch(`${URL}/api/admin/archives/2026-9`)).status).toBe(400);
  });
});
