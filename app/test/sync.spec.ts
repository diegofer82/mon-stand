// Fase 4: emparejamiento, PIN con límite de intentos, bootstrap, sync push/pull idempotente,
// dos teléfonos que venden y cuyo stock cuadra, revocación.
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { Bootstrap, SyncReponse } from '../shared/api';
import type { Op } from '../shared/ops';

const URL = 'http://localhost';
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function appairer(nom: string): Promise<{ deviceId: string; token: string }> {
  const code = await (await SELF.fetch(`${URL}/api/admin/pairing`, { method: 'POST' })).json<{ code: string }>();
  const r = await SELF.fetch(`${URL}/api/devices/pair`, json({ code: code.code, nom }));
  expect(r.status).toBe(201);
  return r.json();
}

async function bootstrap(token: string): Promise<Bootstrap> {
  const r = await SELF.fetch(`${URL}/api/bootstrap`, { headers: auth(token) });
  expect(r.status).toBe(200);
  return r.json();
}

async function sync(token: string, cursor: number, ops: Op[]): Promise<SyncReponse> {
  const r = await SELF.fetch(`${URL}/api/sync`, {
    ...json({ cursor, ops }),
    headers: { ...auth(token), 'Content-Type': 'application/json' },
  });
  expect(r.status).toBe(200);
  return r.json();
}

function opVente(deviceId: string, journeeId: string, articleId: string, qty: number, ts: string): Op {
  const venteId = `vte_${crypto.randomUUID()}`;
  return {
    opId: crypto.randomUUID(),
    deviceId,
    vendeurId: 'vend_1',
    ts,
    type: 'vente.creer',
    vente: {
      id: venteId,
      journeeId,
      vendeurId: 'vend_1',
      deviceId,
      ts,
      sousTotalCfp: 2000 * qty,
      remisePanierCfp: 0,
      remiseEncaissementCfp: 0,
      totalCfp: 2000 * qty,
      annuleeAt: null,
      lignes: [
        {
          id: `lig_${crypto.randomUUID()}`,
          articleId,
          nomSnapshot: 'Collier 200',
          qty,
          prixUnitCfp: 2000,
          totalCfp: 2000 * qty,
        },
      ],
      paiements: [
        {
          id: `pai_${crypto.randomUUID()}`,
          devise: 'CFP',
          montantDevise: 2000 * qty,
          totalDevise: null,
          tauxCfp: null,
          montantCfp: 2000 * qty,
          renduMontant: null,
          renduDevise: null,
        },
      ],
    },
    mouvements: [
      {
        id: `mvt_${crypto.randomUUID()}`,
        articleId,
        delta: -qty,
        motif: 'vente',
        venteId,
        vendeurId: 'vend_1',
        deviceId,
        ts,
      },
    ],
  };
}

function opJournee(deviceId: string, ts: string): Op & { type: 'journee.ouvrir' } {
  return {
    opId: crypto.randomUUID(),
    deviceId,
    vendeurId: 'vend_1',
    ts,
    type: 'journee.ouvrir',
    journee: {
      id: `jour_${crypto.randomUUID()}`,
      dateLocale: '2026-10-03',
      lieu: 'Gare maritime',
      vendeurId: 'vend_1',
      fonds: { CFP: 1000, AUD: 100 },
      ouverteAt: ts,
      clotureeAt: null,
      commentaireCloture: null,
      pdfKey: null,
    },
  };
}

describe('emparejamiento y acceso', () => {
  it('sin token, bootstrap y sync responden 401', async () => {
    expect((await SELF.fetch(`${URL}/api/bootstrap`)).status).toBe(401);
    expect((await SELF.fetch(`${URL}/api/sync`, json({ cursor: 0, ops: [] }))).status).toBe(401);
  });

  it('un código sirve una sola vez y caduca', async () => {
    const code = await (
      await SELF.fetch(`${URL}/api/admin/pairing`, { method: 'POST' })
    ).json<{ code: string; expiresAt: string }>();
    expect(code.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(new Date(code.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const premier = await SELF.fetch(`${URL}/api/devices/pair`, json({ code: code.code.toLowerCase(), nom: 'Tel A' }));
    expect(premier.status).toBe(201);
    const second = await SELF.fetch(`${URL}/api/devices/pair`, json({ code: code.code, nom: 'Tel B' }));
    expect(second.status).toBe(400);
    expect((await second.json<{ erreur: { code: string } }>()).erreur.code).toBe('code_invalide');
  });

  it('el bootstrap siembra el catálogo v1 y entrega el hash del PIN para verificar sin red', async () => {
    const { token, deviceId } = await appairer('Tel bootstrap');
    const b = await bootstrap(token);
    expect(b.device.id).toBe(deviceId);
    expect(b.articles).toHaveLength(25);
    expect(b.categories.map((c) => c.id)).toEqual(['cat_bijoux', 'cat_deco', 'cat_jeux', 'cat_papeterie']);
    const collier = b.mouvements.find((m) => m.articleId === 'art_collier-200');
    expect(collier?.delta).toBeGreaterThanOrEqual(0);
    expect(b.vendeurs[0]?.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.taux.find((t) => t.devise === 'AUD')?.cfpParUnite).toBe(73.77);
  });

  it('PIN: correcto, incorrecto con essais restants, bloqueado al 5º fallo', async () => {
    const { token } = await appairer('Tel PIN');
    await bootstrap(token);
    const ok = await SELF.fetch(`${URL}/api/auth/pin`, {
      ...json({ vendeurId: 'vend_1', pin: '1234' }),
      headers: { ...auth(token), 'Content-Type': 'application/json' },
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, vendeurId: 'vend_1', prenom: 'Vendeuse' });
    let derniere: Response | null = null;
    for (let i = 0; i < 5; i++) {
      derniere = await SELF.fetch(`${URL}/api/auth/pin`, {
        ...json({ vendeurId: 'vend_1', pin: '0000' }),
        headers: { ...auth(token), 'Content-Type': 'application/json' },
      });
    }
    expect(derniere?.status).toBe(401);
    const bloque = await SELF.fetch(`${URL}/api/auth/pin`, {
      ...json({ vendeurId: 'vend_1', pin: '1234' }),
      headers: { ...auth(token), 'Content-Type': 'application/json' },
    });
    expect(bloque.status).toBe(429);
    expect(bloque.headers.get('Retry-After')).toMatch(/^\d+$/);
  });
});

describe('sincronización', () => {
  it('push idempotente y pull entre dos teléfonos: el stock cuadra', async () => {
    const a = await appairer('Tel A');
    const b = await appairer('Tel B');
    const ba = await bootstrap(a.token);
    const bb = await bootstrap(b.token);
    const stockInitial = ba.mouvements.find((m) => m.articleId === 'art_collier-200')?.delta ?? 0;

    const ts = '2026-10-02T20:30:00.000Z';
    const journee = opJournee(a.deviceId, ts);
    const venteA = opVente(a.deviceId, journee.journee.id, 'art_collier-200', 2, ts);
    const r1 = await sync(a.token, ba.cursor, [journee, venteA]);
    expect(r1.acceptes).toEqual([journee.opId, venteA.opId]);
    expect(r1.refuses).toEqual([]);
    expect(r1.ops).toEqual([]); // nada de otros dispositivos
    expect(r1.cursor).toBeGreaterThan(ba.cursor);

    // Reenvío (red inestable): aceptado de nuevo sin aplicar dos veces.
    const r2 = await sync(a.token, r1.cursor, [venteA]);
    expect(r2.acceptes).toEqual([venteA.opId]);

    // El teléfono B vende 3 y recibe lo de A.
    const venteB = opVente(b.deviceId, journee.journee.id, 'art_collier-200', 3, '2026-10-02T20:40:00.000Z');
    const rb = await sync(b.token, bb.cursor, [venteB]);
    expect(rb.acceptes).toEqual([venteB.opId]);
    expect(rb.ops.map((o) => o.opId)).toEqual([journee.opId, venteA.opId]);

    // A recibe lo de B.
    const ra = await sync(a.token, r2.cursor, []);
    expect(ra.ops.map((o) => o.opId)).toEqual([venteB.opId]);

    // Un tercer teléfono arranca de cero: el stock del servidor es la suma de todo.
    const c = await appairer('Tel C');
    const bc = await bootstrap(c.token);
    expect(bc.mouvements.find((m) => m.articleId === 'art_collier-200')?.delta).toBe(stockInitial - 5);
    expect(bc.ventes.filter((v) => v.journeeId === journee.journee.id)).toHaveLength(2);
    expect(bc.journees.find((j) => j.id === journee.journee.id)?.fonds).toEqual({ CFP: 1000, AUD: 100 });
  });

  it('rechaza una operación de otro dispositivo y una carga inválida', async () => {
    const a = await appairer('Tel X');
    const b = await appairer('Tel Y');
    const ba = await bootstrap(a.token);
    const journee = opJournee(b.deviceId, '2026-10-02T21:00:00.000Z');
    const r = await sync(a.token, ba.cursor, [journee]);
    expect(r.acceptes).toEqual([]);
    expect(r.refuses[0]?.opId).toBe(journee.opId);
    const invalide = await SELF.fetch(`${URL}/api/sync`, {
      ...json({ cursor: 'x', ops: [] }),
      headers: { ...auth(a.token), 'Content-Type': 'application/json' },
    });
    expect(invalide.status).toBe(400);
  });

  it('el artículo conserva la escritura más reciente; el PIN cambia por operación', async () => {
    const a = await appairer('Tel Z');
    const ba = await bootstrap(a.token);
    const article = ba.articles.find((x) => x.id === 'art_stylo')!;
    const recente: Op = {
      opId: crypto.randomUUID(),
      deviceId: a.deviceId,
      vendeurId: 'vend_1',
      ts: '2026-10-05T00:00:00.000Z',
      type: 'article.upsert',
      article: {
        ...article,
        nom: 'Stylo bois',
        prixCfp: 1700,
        prixDevises: { AUD: 25 },
        updatedAt: '2026-10-05T00:00:00.000Z',
      },
    };
    const ancienne: Op = {
      opId: crypto.randomUUID(),
      deviceId: a.deviceId,
      vendeurId: 'vend_1',
      ts: '2026-10-04T00:00:00.000Z',
      type: 'article.upsert',
      article: {
        ...article,
        nom: 'Stylo vieux',
        prixCfp: 1600,
        prixDevises: {},
        updatedAt: '2026-10-04T00:00:00.000Z',
      },
    };
    const pin: Op = {
      opId: crypto.randomUUID(),
      deviceId: a.deviceId,
      vendeurId: 'vend_1',
      ts: '2026-10-05T00:00:00.000Z',
      type: 'vendeur.upsert',
      vendeur: {
        id: 'vend_1',
        prenom: 'Vendeuse',
        tauxHoraireCfp: 1500,
        actif: true,
        pinHash: 'ab'.repeat(32),
        pinSalt: 'cd'.repeat(16),
      },
    };
    const r = await sync(a.token, ba.cursor, [recente, ancienne, pin]);
    expect(r.refuses).toEqual([]);
    const b = await bootstrap(a.token);
    const stylo = b.articles.find((x) => x.id === 'art_stylo');
    expect(stylo?.nom).toBe('Stylo bois');
    expect(stylo?.prixDevises).toEqual({ AUD: 25 });
    expect(b.vendeurs.find((v) => v.id === 'vend_1')?.pinHash).toBe('ab'.repeat(32));
  });

  it('un dispositivo revocado recibe 401 y desaparece de la lista activa', async () => {
    const a = await appairer('Tel révoqué');
    const avant = await (
      await SELF.fetch(`${URL}/api/admin/devices`)
    ).json<{ appareils: { id: string; actif: boolean }[] }>();
    expect(avant.appareils.find((d) => d.id === a.deviceId)?.actif).toBe(true);
    expect((await SELF.fetch(`${URL}/api/admin/devices/${a.deviceId}`, { method: 'DELETE' })).status).toBe(200);
    const r = await SELF.fetch(`${URL}/api/bootstrap`, { headers: auth(a.token) });
    expect(r.status).toBe(401);
    expect((await r.json<{ erreur: { code: string } }>()).erreur.code).toBe('appareil_inconnu');
  });
});
