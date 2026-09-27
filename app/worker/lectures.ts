// Lecturas compuestas de D1 → modelos del dominio (ventas con líneas y pagos, jornadas con fondos).
// Las usan el bootstrap, el panel de administración y el PDF de cierre.
import { desc, gte, inArray, or, sql } from 'drizzle-orm';

import type { Journee, Vente } from '../shared/domaine/types';
import { schema, type Base } from './db';

export async function chargerJournees(
  db: Base,
  options: { depuis?: string; ids?: string[]; limite?: number },
): Promise<Journee[]> {
  let requete = db.select().from(schema.journees).$dynamic();
  if (options.ids) {
    if (options.ids.length === 0) return [];
    requete = requete.where(inArray(schema.journees.id, options.ids));
  } else if (options.depuis) {
    requete = requete.where(
      or(sql`${schema.journees.clotureeAt} IS NULL`, gte(schema.journees.ouverteAt, options.depuis)),
    );
  }
  const rows = await requete.orderBy(desc(schema.journees.ouverteAt)).limit(options.limite ?? 500);
  if (rows.length === 0) return [];
  const fonds = await db
    .select()
    .from(schema.journeeFonds)
    .where(
      inArray(
        schema.journeeFonds.journeeId,
        rows.map((j) => j.id),
      ),
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
    db.select().from(schema.ventes).where(inArray(schema.ventes.journeeId, journeeIds)).orderBy(desc(schema.ventes.ts)),
    db
      .select()
      .from(schema.venteLignes)
      .where(sql`${schema.venteLignes.venteId} IN (SELECT id FROM ventes WHERE journee_id IN ${journeeIds})`),
    db
      .select()
      .from(schema.ventePaiements)
      .where(sql`${schema.ventePaiements.venteId} IN (SELECT id FROM ventes WHERE journee_id IN ${journeeIds})`),
  ]);
  const lignesPar = new Map<string, Vente['lignes']>();
  for (const { venteId, ...l } of lignes) lignesPar.set(venteId, [...(lignesPar.get(venteId) ?? []), l]);
  const paiementsPar = new Map<string, Vente['paiements']>();
  for (const { venteId, ...p } of paiements) paiementsPar.set(venteId, [...(paiementsPar.get(venteId) ?? []), p]);
  return ventes.map((v) => ({ ...v, lignes: lignesPar.get(v.id) ?? [], paiements: paiementsPar.get(v.id) ?? [] }));
}

export async function chargerComptages(db: Base, journeeIds: string[]) {
  if (journeeIds.length === 0) return [];
  return db.select().from(schema.comptagesCaisse).where(inArray(schema.comptagesCaisse.journeeId, journeeIds));
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
