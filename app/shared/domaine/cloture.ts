// Cierre del día: KPIs, reparto por modo de pago, top de artículos y lo esperado en caja por divisa.
import { arrondir, arrondirMontant, DEVISES, type Devise, type ModePaiement } from '../montants';
import { estEspeceEtrangere } from './encaissement';
import type { Journee, Vente } from './types';

export interface RepartitionPaiement {
  devise: ModePaiement;
  nb: number;
  /** Suma de lo recibido en la divisa (CFP para CFP y TPE), sin restar la monnaie. */
  montantDevise: number;
  /** Monnaie devuelta en esa divisa. */
  rendu: number;
  /** Lo acreditado en CFP. */
  montantCfp: number;
}

export interface TopArticle {
  articleId: string;
  nom: string;
  qty: number;
  totalCfp: number;
}

export interface ResumeJournee {
  nbVentes: number;
  nbArticles: number;
  sousTotalCfp: number;
  remisesPanierCfp: number;
  remisesEncaissementCfp: number;
  /** CA = lo acreditado en CFP. */
  totalEncaisseCfp: number;
  panierMoyenCfp: number;
  parPaiement: RepartitionPaiement[];
  topArticles: TopArticle[];
}

export function ventesValides(ventes: Vente[]): Vente[] {
  return ventes.filter((v) => !v.annuleeAt);
}

export function resumeJournee(ventes: Vente[], topN: number = 5): ResumeJournee {
  const valides = ventesValides(ventes);
  const r: ResumeJournee = {
    nbVentes: valides.length,
    nbArticles: 0,
    sousTotalCfp: 0,
    remisesPanierCfp: 0,
    remisesEncaissementCfp: 0,
    totalEncaisseCfp: 0,
    panierMoyenCfp: 0,
    parPaiement: [],
    topArticles: [],
  };
  const par = new Map<ModePaiement, RepartitionPaiement>();
  const top = new Map<string, TopArticle>();
  for (const v of valides) {
    r.sousTotalCfp += v.sousTotalCfp;
    r.remisesPanierCfp += v.remisePanierCfp;
    r.remisesEncaissementCfp += v.remiseEncaissementCfp;
    for (const p of v.paiements) {
      r.totalEncaisseCfp += p.montantCfp;
      const e = par.get(p.devise) ?? { devise: p.devise, nb: 0, montantDevise: 0, rendu: 0, montantCfp: 0 };
      e.nb++;
      e.montantDevise = arrondirMontant(e.montantDevise + p.montantDevise, p.devise);
      e.rendu = arrondirMontant(e.rendu + (p.renduMontant ?? 0), p.devise);
      e.montantCfp += p.montantCfp;
      par.set(p.devise, e);
    }
    for (const l of v.lignes) {
      r.nbArticles += l.qty;
      const t = top.get(l.articleId) ?? { articleId: l.articleId, nom: l.nomSnapshot, qty: 0, totalCfp: 0 };
      t.qty += l.qty;
      t.totalCfp += l.totalCfp;
      top.set(l.articleId, t);
    }
  }
  r.panierMoyenCfp = r.nbVentes ? arrondir(r.totalEncaisseCfp / r.nbVentes) : 0;
  const ordre: string[] = [...DEVISES, 'TPE'];
  r.parPaiement = [...par.values()].sort((a, b) => ordre.indexOf(a.devise) - ordre.indexOf(b.devise));
  r.topArticles = [...top.values()].sort((a, b) => b.qty - a.qty || b.totalCfp - a.totalCfp).slice(0, topN);
  return r;
}

export interface AttenduCaisse {
  devise: Devise;
  fond: number;
  recu: number;
  rendu: number;
  attendu: number;
}

/**
 * Efectivo esperado por divisa al contar la caja: fondo + recibido − monnaie devuelta (en esa divisa).
 * Solo las divisas en efectivo con fondo o con movimiento; la tarjeta no se cuenta.
 */
export function attenduParDevise(journee: Pick<Journee, 'fonds'>, ventes: Vente[]): AttenduCaisse[] {
  const map = new Map<Devise, AttenduCaisse>();
  const obtenir = (d: Devise) => {
    const e = map.get(d) ?? { devise: d, fond: journee.fonds[d] ?? 0, recu: 0, rendu: 0, attendu: 0 };
    map.set(d, e);
    return e;
  };
  for (const d of DEVISES) if ((journee.fonds[d] ?? 0) > 0) obtenir(d);
  for (const v of ventesValides(ventes)) {
    for (const p of v.paiements) {
      if (p.devise === 'TPE') continue;
      const devise: Devise = estEspeceEtrangere(p.devise) ? p.devise : 'CFP';
      const e = obtenir(devise);
      e.recu = arrondirMontant(e.recu + p.montantDevise, devise);
      if (p.renduMontant && p.renduDevise) {
        const r = obtenir(p.renduDevise);
        r.rendu = arrondirMontant(r.rendu + p.renduMontant, p.renduDevise);
      }
    }
  }
  const ordre: string[] = [...DEVISES];
  return [...map.values()]
    .map((e) => ({ ...e, attendu: arrondirMontant(e.fond + e.recu - e.rendu, e.devise) }))
    .sort((a, b) => ordre.indexOf(a.devise) - ordre.indexOf(b.devise));
}

export function ecartComptage(attendu: number, compte: number, devise: Devise): number {
  return arrondirMontant(compte - attendu, devise);
}
