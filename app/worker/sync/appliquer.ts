// Aplica una operación a D1 en un solo batch (atómico) y la anota en sync_ops y sync_journal.
// Espejo de src/db/appliquer.ts: stock = suma de movimientos; artículos = última escritura gana por updated_at.
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { Op } from '../../shared/ops';
import { schema, type Base } from '../db';
import { morceaux } from '../db/morceaux';

type Requete = Parameters<Base['batch']>[0][number];

/** True si la operación ya fue aplicada (reenvío): no se vuelve a aplicar. */
export async function dejaAppliquee(db: Base, opId: string): Promise<boolean> {
  const rows = await db
    .select({ opId: schema.syncOps.opId })
    .from(schema.syncOps)
    .where(eq(schema.syncOps.opId, opId))
    .limit(1);
  return rows.length > 0;
}

export async function appliquerOpD1(db: Base, op: Op): Promise<void> {
  const requetes: Requete[] = [];
  switch (op.type) {
    case 'vente.creer': {
      const { lignes, paiements, ...vente } = op.vente;
      requetes.push(db.insert(schema.ventes).values(vente).onConflictDoNothing());
      for (const m of morceaux(
        lignes.map((l) => ({ ...l, venteId: vente.id })),
        7,
      ))
        requetes.push(db.insert(schema.venteLignes).values(m).onConflictDoNothing());
      for (const m of morceaux(
        paiements.map((p) => ({ ...p, venteId: vente.id })),
        9,
      ))
        requetes.push(db.insert(schema.ventePaiements).values(m).onConflictDoNothing());
      for (const m of morceaux(op.mouvements, 8))
        requetes.push(db.insert(schema.stockMouvements).values(m).onConflictDoNothing());
      break;
    }
    case 'vente.annuler':
      requetes.push(
        db
          .update(schema.ventes)
          .set({ annuleeAt: op.annuleeAt })
          .where(and(eq(schema.ventes.id, op.venteId), isNull(schema.ventes.annuleeAt))),
      );
      for (const m of morceaux(op.mouvements, 8))
        requetes.push(db.insert(schema.stockMouvements).values(m).onConflictDoNothing());
      break;
    case 'stock.mouvement':
      requetes.push(db.insert(schema.stockMouvements).values(op.mouvement).onConflictDoNothing());
      break;
    case 'article.upsert': {
      const { prixDevises, ...article } = op.article;
      const actuel = await db
        .select({ updatedAt: schema.articles.updatedAt })
        .from(schema.articles)
        .where(eq(schema.articles.id, article.id))
        .limit(1);
      if (actuel[0] && actuel[0].updatedAt > article.updatedAt) break; // llegó una escritura más antigua: se ignora
      requetes.push(
        db.insert(schema.articles).values(article).onConflictDoUpdate({ target: schema.articles.id, set: article }),
        db.delete(schema.articlePrix).where(eq(schema.articlePrix.articleId, article.id)),
      );
      const prix = Object.entries(prixDevises).filter(
        (e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0,
      );
      if (prix.length) {
        requetes.push(
          db.insert(schema.articlePrix).values(
            prix.map(([devise, valeur]) => ({
              articleId: article.id,
              devise: devise as (typeof schema.DEVISES)[number],
              prix: valeur,
              updatedAt: article.updatedAt,
            })),
          ),
        );
      }
      break;
    }
    case 'categorie.upsert':
      requetes.push(
        db
          .insert(schema.categories)
          .values(op.categorie)
          .onConflictDoUpdate({ target: schema.categories.id, set: op.categorie }),
      );
      break;
    case 'journee.ouvrir': {
      const { fonds, ...journee } = op.journee;
      requetes.push(db.insert(schema.journees).values(journee).onConflictDoNothing());
      const lignes = Object.entries(fonds).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0);
      if (lignes.length) {
        requetes.push(
          db
            .insert(schema.journeeFonds)
            .values(
              lignes.map(([devise, montant]) => ({
                journeeId: journee.id,
                devise: devise as (typeof schema.DEVISES)[number],
                montant,
              })),
            )
            .onConflictDoNothing(),
        );
      }
      break;
    }
    case 'journee.cloturer':
      requetes.push(
        db
          .update(schema.journees)
          .set({ clotureeAt: op.clotureeAt, commentaireCloture: op.commentaire })
          .where(eq(schema.journees.id, op.journeeId)),
      );
      if (op.comptages.length)
        requetes.push(db.insert(schema.comptagesCaisse).values(op.comptages).onConflictDoNothing());
      break;
    case 'session.upsert':
      requetes.push(
        db
          .insert(schema.sessionsTravail)
          .values(op.session)
          .onConflictDoUpdate({ target: schema.sessionsTravail.id, set: op.session }),
      );
      break;
    case 'session.supprimer':
      requetes.push(db.delete(schema.sessionsTravail).where(eq(schema.sessionsTravail.id, op.sessionId)));
      break;
    case 'taux.definir':
      requetes.push(
        db
          .insert(schema.tauxHistorique)
          .values({ devise: op.devise, date: op.date, cfpParUnite: op.cfpParUnite, source: op.source })
          .onConflictDoUpdate({
            target: [schema.tauxHistorique.devise, schema.tauxHistorique.date],
            set: { cfpParUnite: op.cfpParUnite, source: op.source },
          }),
      );
      break;
    case 'vendeur.upsert': {
      const { pinHash, pinSalt, ...v } = op.vendeur;
      const avecPin = pinHash && pinSalt ? { pinHash, pinSalt } : {};
      requetes.push(
        db
          .insert(schema.vendeurs)
          .values({ ...v, pinHash: pinHash ?? '', pinSalt: pinSalt ?? '' })
          .onConflictDoUpdate({ target: schema.vendeurs.id, set: { ...v, ...avecPin } }),
      );
      break;
    }
    case 'settings.definir':
      requetes.push(
        db
          .insert(schema.settings)
          .values({ key: op.key, value: op.value })
          .onConflictDoUpdate({ target: schema.settings.key, set: { value: op.value } }),
      );
      break;
  }
  requetes.push(
    db.insert(schema.syncOps).values({ opId: op.opId, deviceId: op.deviceId }).onConflictDoNothing(),
    db
      .insert(schema.syncJournal)
      .values({
        opId: op.opId,
        deviceId: op.deviceId,
        vendeurId: op.vendeurId,
        type: op.type,
        payload: JSON.stringify(op),
      })
      .onConflictDoNothing(),
  );
  const [premiere, ...reste] = requetes;
  if (!premiere) return;
  await db.batch([premiere, ...reste]);
}

/** Último seq del diario (0 si está vacío). */
export async function cursorActuel(db: Base): Promise<number> {
  const rows = await db.select({ max: sql<number | null>`max(${schema.syncJournal.seq})` }).from(schema.syncJournal);
  return rows[0]?.max ?? 0;
}
