// Panier: promo 2ª unidad, remise, totales en CFP y en divisa (reglas v1.4/v1.5 reproducidas por los tests).
import { arrondir, arrondirDevise, arrondirMontant, prixDevise, type Devise } from '../montants';
import type { Article, LignePanier, TableTaux } from './types';

/** Precio unitario de la unidad n (1-based): las pares llevan la promo. */
function prixUnite(prix: number, promo2emePct: number | null, n: number): number {
  return n % 2 === 0 && promo2emePct ? prix * (1 - promo2emePct / 100) : prix;
}

/** Total CFP de una línea: suma unidad a unidad, redondeada al final (v1: calcLT). */
export function totalLigneCfp(prixCfp: number, promo2emePct: number | null, qty: number): number {
  let total = 0;
  for (let n = 1; n <= qty; n++) total += prixUnite(prixCfp, promo2emePct, n);
  return arrondir(total);
}

/** Unidades que llevan la promo en una línea. */
export function unitesEnPromo(promo2emePct: number | null, qty: number): number {
  return promo2emePct ? Math.floor(qty / 2) : 0;
}

/** Precio de venta en divisa: el manual si está fijado, si no el calculado desde el precio CFP (v1.5). */
export function prixVenteDevise(
  article: Pick<Article, 'prixCfp' | 'prixDevises'>,
  devise: Devise,
  taux: TableTaux,
): number {
  const manuel = article.prixDevises[devise];
  if (manuel && manuel > 0) return manuel;
  return prixDevise(article.prixCfp, taux[devise] ?? 0);
}

/** Total de una línea en divisa: la 2ª unidad en promo se redondea como un precio (v1.5: calcLTDevise). */
export function totalLigneDevise(prixDeviseUnit: number, promo2emePct: number | null, qty: number): number {
  let total = 0;
  for (let n = 1; n <= qty; n++) {
    total += n % 2 === 0 && promo2emePct ? arrondirDevise(prixDeviseUnit * (1 - promo2emePct / 100)) : prixDeviseUnit;
  }
  return total;
}

export interface TotauxPanier {
  sousTotalCfp: number;
  remisePanierCfp: number;
  totalCfp: number;
  nbArticles: number;
}

export function totauxPanier(
  lignes: LignePanier[],
  articles: Map<string, Article>,
  remisePanierCfp: number,
): TotauxPanier {
  let sousTotalCfp = 0;
  let nbArticles = 0;
  for (const l of lignes) {
    const a = articles.get(l.articleId);
    if (!a) continue;
    sousTotalCfp += totalLigneCfp(a.prixCfp, a.promo2emePct, l.qty);
    nbArticles += l.qty;
  }
  const remise = Math.max(0, Math.min(arrondir(remisePanierCfp), sousTotalCfp));
  return { sousTotalCfp, remisePanierCfp: remise, totalCfp: Math.max(0, sousTotalCfp - remise), nbArticles };
}

/**
 * Total del panier en una divisa = suma de los precios de venta en divisa (v1.5).
 * Una remise (en CFP) se convierte a la tasa y el total se re-redondea con la regla de precios. 0 si no hay tasa.
 */
export function totalPanierDevise(
  lignes: LignePanier[],
  articles: Map<string, Article>,
  devise: Devise,
  taux: TableTaux,
  remisePanierCfp: number,
): number {
  const t = taux[devise];
  if (!t || !(t > 0)) return 0;
  const { totalCfp, remisePanierCfp: remise } = totauxPanier(lignes, articles, remisePanierCfp);
  if (totalCfp <= 0) return 0;
  let st = 0;
  for (const l of lignes) {
    const a = articles.get(l.articleId);
    if (!a) continue;
    st += totalLigneDevise(prixVenteDevise(a, devise, taux), a.promo2emePct, l.qty);
  }
  st = arrondirMontant(st, devise);
  return remise > 0 ? arrondirDevise(st - remise / t) : st;
}
