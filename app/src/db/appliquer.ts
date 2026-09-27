// Aplica una operación a IndexedDB. La misma lógica, sobre D1, vive en el Worker (Fase 4):
// stock = suma de movimientos; artículos = última escritura gana por `updatedAt`.
import type { Op } from '../../shared/ops';
import { db } from './db';

/** Aplica la operación dentro de una transacción (idempotente: repetirla deja el mismo estado). */
export async function appliquerOp(op: Op): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.categories,
      db.articles,
      db.vendeurs,
      db.mouvements,
      db.journees,
      db.ventes,
      db.comptages,
      db.sessions,
      db.taux,
      db.settings,
    ],
    async () => {
      switch (op.type) {
        case 'vente.creer':
          await db.ventes.put(op.vente);
          await db.mouvements.bulkPut(op.mouvements);
          break;
        case 'vente.annuler': {
          const v = await db.ventes.get(op.venteId);
          if (v && !v.annuleeAt) await db.ventes.put({ ...v, annuleeAt: op.annuleeAt });
          await db.mouvements.bulkPut(op.mouvements);
          break;
        }
        case 'stock.mouvement':
          await db.mouvements.put(op.mouvement);
          break;
        case 'article.upsert': {
          const actuel = await db.articles.get(op.article.id);
          if (!actuel || actuel.updatedAt <= op.article.updatedAt) await db.articles.put(op.article);
          break;
        }
        case 'categorie.upsert':
          await db.categories.put(op.categorie);
          break;
        case 'journee.ouvrir': {
          const actuelle = await db.journees.get(op.journee.id);
          if (!actuelle) await db.journees.put(op.journee);
          break;
        }
        case 'journee.cloturer': {
          const j = await db.journees.get(op.journeeId);
          if (j) await db.journees.put({ ...j, clotureeAt: op.clotureeAt, commentaireCloture: op.commentaire });
          await db.comptages.bulkPut(op.comptages);
          break;
        }
        case 'session.upsert':
          await db.sessions.put(op.session);
          break;
        case 'session.supprimer':
          await db.sessions.delete(op.sessionId);
          break;
        case 'taux.definir':
          await db.taux.put({ devise: op.devise, cfpParUnite: op.cfpParUnite, source: op.source, date: op.date });
          break;
        case 'vendeur.upsert': {
          const v = await db.vendeurs.get(op.vendeur.id);
          await db.vendeurs.put({ pinHash: v?.pinHash ?? '', pinSalt: v?.pinSalt ?? '', ...op.vendeur });
          break;
        }
        case 'settings.definir':
          await db.settings.put({ key: op.key, value: op.value });
          break;
      }
    },
  );
}

/** Aplica la operación y la deja en el outbox para el servidor (una sola transacción: o las dos o ninguna). */
export async function emettreOp(op: Op): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await appliquerOp(op);
    await db.outbox.put({ opId: op.opId, op, createdAt: op.ts, tentatives: 0, erreur: null });
  });
}
