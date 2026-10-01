// Lecturas compuestas de D1 → modelos del dominio (ventas con líneas y pagos, jornadas con fondos).
// Las usan el bootstrap, el panel de administración y el PDF de cierre.
import { desc, gte, inArray, like, or, sql } from 'drizzle-orm';

import type { Journee, Vente } from '../shared/domaine/types';
import { schema, type Base } from './db';

// D1 admite 100 parámetros ligados por sentencia: una lista IN (...) larga se lee por lotes (con margen
// para los demás parámetros de la consulta). Sin esto, el panel fallaba a partir de 100 jornadas.
const LOT_IDS = 90;

async function parLots<T>(ids: readonly string[], lire: (lot: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += LOT_IDS) out.push(...(await lire(ids.slice(i, i + LOT_IDS))));
  return out;
}

export async function chargerJournees(
  db: Base,
  options: { depuis?: string; ids?: string[]; mois?: string; limite?: number },
): Promise<Journee[]> {
  const limite = options.limite ?? 500;
  let rows: (typeof schema.journees.$inferSelect)[];
  if (options.ids) {
    rows = await parLots(options.ids, (lot) =>
      db.select().from(schema.journees).where(inArray(schema.journees.id, lot)),
    );
    rows = rows.sort((a, b) => b.ouverteAt.localeCompare(a.ouverteAt)).slice(0, limite);
  } else {
    let requete = db.select().from(schema.journees).$dynamic();
    if (options.mois) {
      // «AAAA-MM» → las jornadas de ese mes (fecha de negocio de Nouméa), filtradas en SQL.
      requete = requete.where(like(schema.journees.dateLocale, `${options.mois}-%`));
    } else if (options.depuis) {
      requete = requete.where(
        or(sql`${schema.journees.clotureeAt} IS NULL`, gte(schema.journees.ouverteAt, options.depuis)),
      );
    }
    rows = await requete.orderBy(desc(schema.journees.ouverteAt)).limit(limite);
  }
  if (rows.length === 0) return [];
  const fonds = await parLots(
    rows.map((j) => j.id),
    (lot) => db.select().from(schema.journeeFonds).where(inArray(schema.journeeFonds.journeeId, lot)),
  );
  const parJournee = new Map<string, Journee['fonds']>();
  for (const f of fonds) {
    const m = parJournee.get(f.journeeId) ?? {};
    m[f.devise] = f.montant;
    parJournee.set(f.journeeId, m);
  }
  return rows.map(({ fondCaisseCfp: _f, ...j }) => ({ ...j, fonds: parJournee.get(j.id) ?? {} }));
}

/** Ventas de las jornadas dadas, con líneas y pagos, más recientes primero. */
export async function chargerVentes(db: Base, journeeIds: string[]): Promise<Vente[]> {
  if (journeeIds.length === 0) return [];
  const [ventes, lignes, paiements] = await Promise.all([
    parLots(journeeIds, (lot) => db.select().from(schema.ventes).where(inArray(schema.ventes.journeeId, lot))),
    parLots(journeeIds, (lot) =>
      db
        .select()
        .from(schema.venteLignes)
        .where(sql`${schema.venteLignes.venteId} IN (SELECT id FROM ventes WHERE journee_id IN ${lot})`),
    ),
    parLots(journeeIds, (lot) =>
      db
        .select()
        .from(schema.ventePaiements)
        .where(sql`${schema.ventePaiements.venteId} IN (SELECT id FROM ventes WHERE journee_id IN ${lot})`),
    ),
  ]);
  ventes.sort((a, b) => b.ts.localeCompare(a.ts));
  const lignesPar = new Map<string, Vente['lignes']>();
  for (const { venteId, ...l } of lignes) lignesPar.set(venteId, [...(lignesPar.get(venteId) ?? []), l]);
  const paiementsPar = new Map<string, Vente['paiements']>();
  for (const { venteId, ...p } of paiements) paiementsPar.set(venteId, [...(paiementsPar.get(venteId) ?? []), p]);
  return ventes.map((v) => ({ ...v, lignes: lignesPar.get(v.id) ?? [], paiements: paiementsPar.get(v.id) ?? [] }));
}

export async function chargerComptages(db: Base, journeeIds: string[]) {
  return parLots(journeeIds, (lot) =>
    db.select().from(schema.comptagesCaisse).where(inArray(schema.comptagesCaisse.journeeId, lot)),
  );
}

/** Última tasa por divisa. */
export async function chargerTaux(db: Base) {
  return db
    .select()
    .from(schema.tauxHistorique)
    .where(
      sql`(${schema.tauxHistorique.devise}, ${schema.tauxHistorique.date}) IN (SELECT devise, max(date) FROM taux_historique GROUP BY devise)`,
    );
}
