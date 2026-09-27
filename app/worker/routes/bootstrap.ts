// Instantánea completa para un teléfono recién emparejado: catálogo, vendedoras (hash de PIN para verificar
// sin red), tasas, ajustes, stock actual, jornadas recientes con sus ventas y conteos, sesiones.
import { desc, gte, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Bootstrap } from '../../shared/api';
import type { Article } from '../../shared/domaine/types';
import { type AppEnv } from '../auth';
import { schema } from '../db';
import { chargerComptages, chargerJournees, chargerTaux, chargerVentes } from '../lectures';
import { DEVICE_SERVEUR_ID, semerSiVide, VENDEUR_DEFAUT_ID } from '../semence';
import { cursorActuel } from '../sync/appliquer';

export const bootstrap = new Hono<AppEnv>();

const JOURS_HISTORIQUE = 90;

bootstrap.get('/', async (c) => {
  const db = c.get('db');
  const appareil = c.get('appareil');
  await semerSiVide(db);
  const maintenant = new Date();
  const depuis = new Date(maintenant.getTime() - JOURS_HISTORIQUE * 86400000).toISOString();

  const [cursor, categories, articlesRows, prixRows, vendeurs, taux, settings, stock, journees, sessions] =
    await Promise.all([
      cursorActuel(db),
      db.select().from(schema.categories).orderBy(schema.categories.ordre),
      db.select().from(schema.articles),
      db.select().from(schema.articlePrix),
      db.select().from(schema.vendeurs),
      chargerTaux(db),
      db.select().from(schema.settings),
      db
        .select({ articleId: schema.stockMouvements.articleId, qty: sql<number>`sum(${schema.stockMouvements.delta})` })
        .from(schema.stockMouvements)
        .groupBy(schema.stockMouvements.articleId),
      chargerJournees(db, { depuis, limite: 120 }),
      db
        .select()
        .from(schema.sessionsTravail)
        .where(gte(schema.sessionsTravail.debut, depuis))
        .orderBy(desc(schema.sessionsTravail.debut)),
    ]);

  const prixParArticle = new Map<string, Article['prixDevises']>();
  for (const p of prixRows) {
    const m = prixParArticle.get(p.articleId) ?? {};
    m[p.devise] = p.prix;
    prixParArticle.set(p.articleId, m);
  }
  const articles: Article[] = articlesRows.map((a) => ({ ...a, prixDevises: prixParArticle.get(a.id) ?? {} }));
  const journeeIds = journees.map((j) => j.id);
  const [ventes, comptages] = await Promise.all([chargerVentes(db, journeeIds), chargerComptages(db, journeeIds)]);

  const ts = maintenant.toISOString();
  const reponse: Bootstrap = {
    cursor,
    serveurAt: ts,
    device: { id: appareil.id, nom: appareil.nom },
    categories,
    articles,
    vendeurs: vendeurs.map(({ createdAt: _c, ...v }) => v),
    taux: taux.map((t) => ({ devise: t.devise, cfpParUnite: t.cfpParUnite, source: t.source, date: t.date })),
    settings,
    mouvements: stock.map((s) => ({
      id: `snap_${s.articleId}`,
      articleId: s.articleId,
      delta: s.qty,
      motif: 'inventaire',
      venteId: null,
      vendeurId: VENDEUR_DEFAUT_ID,
      deviceId: DEVICE_SERVEUR_ID,
      ts,
    })),
    journees,
    ventes,
    comptages,
    sessions,
  };
  return c.json(reponse);
});
