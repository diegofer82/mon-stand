// Stock como libro de movimientos: la cantidad es la suma; orden de la caja por ventas recientes.
import type { Article, MouvementStock, Vente } from './types';

export const SEUIL_FAIBLE = 2;

export type EtatStock = 'epuise' | 'faible' | 'ok';

export function etatStock(qty: number, seuil: number = SEUIL_FAIBLE): EtatStock {
  if (qty <= 0) return 'epuise';
  return qty <= seuil ? 'faible' : 'ok';
}

/** Cantidad por artículo = suma de los deltas de sus movimientos. */
export function quantites(mouvements: Pick<MouvementStock, 'articleId' | 'delta'>[]): Map<string, number> {
  const q = new Map<string, number>();
  for (const m of mouvements) q.set(m.articleId, (q.get(m.articleId) ?? 0) + m.delta);
  return q;
}

/** Unidades vendidas por artículo en las ventas dadas (sin las anuladas). */
export function unitesVendues(ventes: Pick<Vente, 'annuleeAt' | 'lignes'>[]): Map<string, number> {
  const u = new Map<string, number>();
  for (const v of ventes) {
    if (v.annuleeAt) continue;
    for (const l of v.lignes) u.set(l.articleId, (u.get(l.articleId) ?? 0) + l.qty);
  }
  return u;
}

/**
 * Orden de la pestaña «Tout» de la caja (§4): más vendidos primero (unidades en los últimos 30 días),
 * empate por nombre; agotados al final. Los artículos sin precio no se venden y quedan fuera.
 */
export function ordreCaisse(
  articles: Article[],
  quantite: Map<string, number>,
  vendues: Map<string, number>,
): Article[] {
  const collator = new Intl.Collator('fr');
  return articles
    .filter((a) => a.actif && a.prixCfp > 0)
    .sort((a, b) => {
      const ea = (quantite.get(a.id) ?? 0) <= 0 ? 1 : 0;
      const eb = (quantite.get(b.id) ?? 0) <= 0 ? 1 : 0;
      if (ea !== eb) return ea - eb;
      const va = vendues.get(a.id) ?? 0;
      const vb = vendues.get(b.id) ?? 0;
      if (va !== vb) return vb - va;
      return collator.compare(a.nom, b.nom);
    });
}

/** Fecha límite (instante ISO) de la ventana de 30 días que alimenta el orden de la caja. */
export function debutFenetreVentes(maintenant: Date, jours: number = 30): string {
  return new Date(maintenant.getTime() - jours * 86400000).toISOString();
}
